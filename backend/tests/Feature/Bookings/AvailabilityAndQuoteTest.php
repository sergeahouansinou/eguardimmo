<?php

declare(strict_types=1);

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Listings\Enums\ListingStatus;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Bookings\BookingsContext as B;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    M::semer();
    $this->travelTo(B::AUJOURDHUI);
    $this->org = C::organisation();
    $this->annonce = M::annonce($this->org, ['price_minor' => 9000, 'capacity' => 4, 'min_nights' => 2]);
    $this->base = "/api/v1/marketplace/listings/{$this->annonce->public_ref}";
});

it('liste les plages occupées, sans identité, avec le départ exclusif', function (): void {
    $voyageur = (string) fake()->uuid();
    B::enAttente($this->org, $this->annonce, $voyageur, ['check_in' => '2026-12-10', 'check_out' => '2026-12-13']);
    B::reservation($this->org, $this->annonce, $voyageur, ['check_in' => '2026-12-01', 'check_out' => '2026-12-04']);
    B::reservation($this->org, $this->annonce, $voyageur, ['status' => BookingStatus::Cancelled, 'cancelled_at' => now(), 'check_in' => '2026-12-20', 'check_out' => '2026-12-22']);
    B::enAttente($this->org, $this->annonce, $voyageur, ['expires_at' => now()->subMinute(), 'check_in' => '2026-12-24', 'check_out' => '2026-12-26']);
    B::reservation($this->org, M::annonce($this->org), $voyageur, ['check_in' => '2026-12-05', 'check_out' => '2026-12-07']);

    $reponse = $this->getJson("{$this->base}/availability?from=2026-12-01&to=2027-01-01")->assertOk();

    expect($reponse->json('data'))->toBe([
        ['check_in' => '2026-12-01', 'check_out' => '2026-12-04'],
        ['check_in' => '2026-12-10', 'check_out' => '2026-12-13'],
    ])->and($reponse->getContent())->not->toContain($voyageur)->not->toContain('SB-')->not->toContain('status');
});

it('ne renvoie que les plages qui touchent la fenêtre demandée', function (): void {
    B::reservation($this->org, $this->annonce, (string) fake()->uuid(), ['check_in' => '2026-12-10', 'check_out' => '2026-12-13']);

    $this->getJson("{$this->base}/availability?from=2026-12-13&to=2026-12-20")->assertOk()->assertJsonCount(0, 'data');
    $this->getJson("{$this->base}/availability?from=2026-12-12&to=2026-12-20")->assertOk()->assertJsonCount(1, 'data');
});

it('valide la fenêtre et répond 404 hors annonce publiée', function (): void {
    foreach (['', 'from=2026-12-01', 'from=2026-12-05&to=2026-12-01', 'from=2026-12-01&to=2028-01-01', 'from=hier&to=demain'] as $requete) {
        $this->getJson("{$this->base}/availability?{$requete}")->assertUnprocessable();
    }

    $brouillon = M::annonce($this->org, [], ListingStatus::Draft);
    $this->getJson("/api/v1/marketplace/listings/{$brouillon->public_ref}/availability?from=2026-12-01&to=2026-12-05")->assertNotFound();
});

it('limite le débit de la disponibilité par IP', function (): void {
    foreach (range(1, 60) as $_) {
        $this->getJson("{$this->base}/availability?from=2026-12-01&to=2026-12-05")->assertOk();
    }

    $this->getJson("{$this->base}/availability?from=2026-12-01&to=2026-12-05")->assertTooManyRequests();
});

it('calcule un devis public sans rien écrire', function (): void {
    config(['marketplace.service_fee_basis_points' => 100]);
    B::enAttente($this->org, $this->annonce, (string) fake()->uuid(), ['check_in' => '2026-12-20', 'check_out' => '2026-12-22']);
    $avant = DB::table('bookings')->count();

    $devis = $this->postJson("{$this->base}/quote", ['check_in' => '2026-12-10', 'check_out' => '2026-12-14', 'guests' => 3])->assertOk()->json('data');

    expect($devis)->toBe([
        'nights' => 4,
        'nightly' => ['amount' => 9000, 'currency' => 'EUR'],
        'subtotal' => ['amount' => 36000, 'currency' => 'EUR'],
        'service_fee' => ['amount' => 360, 'currency' => 'EUR'],
        'total' => ['amount' => 36360, 'currency' => 'EUR'],
        'cancellation_policy' => 'moderate',
        'available' => true,
    ])->and(DB::table('bookings')->count())->toBe($avant);

    $this->postJson("{$this->base}/quote", ['check_in' => '2026-12-19', 'check_out' => '2026-12-21', 'guests' => 2])->assertOk()->assertJsonPath('data.available', false);
});

it('refuse un devis invalide et ignore les montants envoyés', function (): void {
    $this->postJson("{$this->base}/quote", ['check_in' => '2026-12-10', 'check_out' => '2026-12-14', 'guests' => 9])->assertUnprocessable()->assertJsonPath('code', 'guests_exceed_capacity');
    $this->postJson("{$this->base}/quote", ['check_in' => '2026-12-10', 'check_out' => '2026-12-11', 'guests' => 1])->assertUnprocessable()->assertJsonPath('code', 'min_nights_not_met');
    $this->postJson("{$this->base}/quote", ['check_in' => '2020-12-10', 'check_out' => '2020-12-14', 'guests' => 1])->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
    $this->postJson("{$this->base}/quote", [])->assertUnprocessable();
    $this->postJson("{$this->base}/quote", ['check_in' => '2026-12-10', 'check_out' => '2026-12-14', 'guests' => 1, 'total_minor' => 1, 'nightly_minor' => 1])->assertOk()->assertJsonPath('data.total.amount', 36000);

    $long = M::annonce($this->org, ['kind' => 'long_term', 'price_unit' => 'month']);
    $this->postJson("/api/v1/marketplace/listings/{$long->public_ref}/quote", ['check_in' => '2026-12-10', 'check_out' => '2026-12-14', 'guests' => 1])->assertUnprocessable()->assertJsonPath('code', 'listing_not_bookable');
    $brouillon = M::annonce($this->org, [], ListingStatus::Draft);
    $this->postJson("/api/v1/marketplace/listings/{$brouillon->public_ref}/quote", ['check_in' => '2026-12-10', 'check_out' => '2026-12-14', 'guests' => 1])->assertNotFound();
});

it('limite le débit du devis par IP', function (): void {
    foreach (range(1, 30) as $_) {
        $this->postJson("{$this->base}/quote", ['check_in' => '2026-12-10', 'check_out' => '2026-12-14', 'guests' => 1])->assertOk();
    }

    $this->postJson("{$this->base}/quote", ['check_in' => '2026-12-10', 'check_out' => '2026-12-14', 'guests' => 1])->assertTooManyRequests();
});
