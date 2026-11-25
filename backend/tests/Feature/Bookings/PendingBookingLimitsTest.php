<?php

declare(strict_types=1);

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Bookings\BookingsContext as B;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    M::semer();
    $this->travelTo(B::AUJOURDHUI);
    $this->org = C::organisation();
    $this->a = M::annonce($this->org, ['capacity' => 4]);
    $this->b = M::annonce($this->org, ['capacity' => 4]);
    $this->c = M::annonce($this->org, ['capacity' => 4]);
    $this->moi = M::voyageur();
    $this->actingAs($this->moi);
});

function reserverEn(array $corps, string $cle): TestResponse
{
    return test()->postJson('/api/v1/marketplace/bookings', $corps, ['Idempotency-Key' => $cle]);
}

function enAttenteDuCompte(): int
{
    return AcrossOrganizations::query(Booking::class)->where('user_id', test()->moi->id)->where('status', BookingStatus::PendingPayment->value)->count();
}

it('refuse une deuxième réservation en attente du même compte sur la même annonce', function (): void {
    reserverEn(B::corps($this->a), 'cle-premiere-1')->assertCreated();

    reserverEn(B::corps($this->a, ['check_in' => '2027-02-01', 'check_out' => '2027-02-04']), 'cle-seconde-02')
        ->assertConflict()->assertJsonPath('code', 'pending_booking_exists');

    expect(enAttenteDuCompte())->toBe(1);
    reserverEn(B::corps($this->b), 'cle-autre-ann-3')->assertCreated();
});

it('refuse une troisième réservation en attente, quelles que soient les annonces', function (): void {
    reserverEn(B::corps($this->a), 'cle-annonce-a-1')->assertCreated();
    reserverEn(B::corps($this->b), 'cle-annonce-b-2')->assertCreated();

    reserverEn(B::corps($this->c), 'cle-annonce-c-3')->assertConflict()->assertJsonPath('code', 'too_many_pending_bookings');

    expect(enAttenteDuCompte())->toBe(2);
});

it('ne consomme aucun numéro de référence quand le plafond refuse', function (): void {
    reserverEn(B::corps($this->a), 'cle-annonce-a-1')->assertCreated();
    reserverEn(B::corps($this->b), 'cle-annonce-b-2')->assertCreated();
    reserverEn(B::corps($this->c), 'cle-annonce-c-3')->assertConflict();

    $autre = M::voyageur();
    $this->actingAs($autre);
    reserverEn(B::corps($this->c), 'cle-autre-compte')->assertCreated()->assertJsonPath('data.reference', 'SB-2026-000003');
});

it('ne compte ni les réservations expirées, ni annulées, ni confirmées, ni celles d\'un autre compte', function (): void {
    B::enAttente($this->org, $this->a, $this->moi->id, ['expires_at' => now()->subMinute(), 'check_in' => '2027-03-01', 'check_out' => '2027-03-03']);
    B::reservation($this->org, $this->a, $this->moi->id, ['status' => BookingStatus::Cancelled, 'check_in' => '2027-04-01', 'check_out' => '2027-04-03']);
    B::reservation($this->org, $this->b, $this->moi->id, ['status' => BookingStatus::Confirmed, 'check_in' => '2027-05-01', 'check_out' => '2027-05-03']);
    B::reservation($this->org, $this->b, $this->moi->id, ['status' => BookingStatus::Confirmed, 'check_in' => '2027-06-01', 'check_out' => '2027-06-03']);
    B::enAttente($this->org, $this->a, M::voyageur()->id, ['check_in' => '2027-07-01', 'check_out' => '2027-07-03']);

    reserverEn(B::corps($this->a), 'cle-annonce-a-1')->assertCreated();
    reserverEn(B::corps($this->b), 'cle-annonce-b-2')->assertCreated();
});

it('libère le plafond quand une réservation en attente est annulée', function (): void {
    $premiere = reserverEn(B::corps($this->a), 'cle-annonce-a-1')->assertCreated()->json('data.id');
    reserverEn(B::corps($this->a, ['check_in' => '2027-02-01', 'check_out' => '2027-02-04']), 'cle-annonce-a-2')->assertConflict();

    $this->postJson("/api/v1/marketplace/bookings/{$premiere}/cancel")->assertOk();

    reserverEn(B::corps($this->a, ['check_in' => '2027-02-01', 'check_out' => '2027-02-04']), 'cle-annonce-a-2')->assertCreated();
});

it('rejoue une demande déjà enregistrée sans la compter une seconde fois, même plafond atteint', function (): void {
    $premiere = reserverEn(B::corps($this->a), 'cle-annonce-a-1')->assertCreated()->json('data.id');
    reserverEn(B::corps($this->b), 'cle-annonce-b-2')->assertCreated();

    reserverEn(B::corps($this->a), 'cle-annonce-a-1')->assertOk()->assertJsonPath('data.id', $premiere);

    expect(enAttenteDuCompte())->toBe(2);
});

it('limite POST /bookings à 10 par heure et par compte, sans toucher aux lectures ni aux autres comptes', function (): void {
    reserverEn(B::corps($this->a), 'cle-annonce-a-1')->assertCreated();

    foreach (range(2, 10) as $_) {
        reserverEn(B::corps($this->a), 'cle-annonce-a-1')->assertOk();
    }

    reserverEn(B::corps($this->a), 'cle-annonce-a-1')->assertTooManyRequests()->assertJsonPath('code', 'too_many_requests');

    $this->getJson('/api/v1/marketplace/bookings')->assertOk();
    $this->actingAs(M::voyageur());
    reserverEn(B::corps($this->b), 'cle-autre-compte')->assertCreated();
});
