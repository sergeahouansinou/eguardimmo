<?php

declare(strict_types=1);

use App\Modules\Bookings\Models\Booking;
use App\Modules\Organizations\Enums\MemberRole;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Tests\Feature\Bookings\BookingsContext as B;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    M::semer();
    $this->travelTo(B::AUJOURDHUI);
    $this->org = C::organisation();
    $this->annonce = M::annonce($this->org);
    $this->moi = M::voyageur();
    $this->autre = M::voyageur();
    $this->miennes = B::reservation($this->org, $this->annonce, $this->moi->id, ['check_in' => '2026-12-10', 'check_out' => '2026-12-12']);
    $this->siennes = B::reservation($this->org, $this->annonce, $this->autre->id, ['check_in' => '2026-12-20', 'check_out' => '2026-12-22']);
});

it('exige un compte connecté sur chaque route de réservation', function (): void {
    foreach ([
        ['get', '/api/v1/marketplace/bookings'],
        ['get', "/api/v1/marketplace/bookings/{$this->miennes->id}"],
        ['post', "/api/v1/marketplace/bookings/{$this->miennes->id}/cancel"],
        ['post', '/api/v1/marketplace/bookings'],
    ] as [$methode, $url]) {
        $this->json($methode, $url)->assertUnauthorized();
    }
});

it('répond 404 sur la réservation d\'un autre voyageur, en lecture comme en annulation', function (): void {
    $this->actingAs($this->moi);

    $this->getJson("/api/v1/marketplace/bookings/{$this->siennes->id}")->assertNotFound()->assertJsonPath('code', 'booking_not_found');
    $this->postJson("/api/v1/marketplace/bookings/{$this->siennes->id}/cancel")->assertNotFound()->assertJsonPath('code', 'booking_not_found');
    $this->getJson('/api/v1/marketplace/bookings/'.fake()->uuid())->assertNotFound();
    $this->getJson('/api/v1/marketplace/bookings/pas-un-uuid')->assertNotFound();

    expect(AcrossOrganizations::query(Booking::class)->findOrFail($this->siennes->id)->status->value)->toBe('confirmed');
});

it('ne liste que les réservations du compte connecté', function (): void {
    $this->actingAs($this->moi);

    $reponse = $this->getJson('/api/v1/marketplace/bookings')->assertOk();

    expect($reponse->json('data.*.id'))->toBe([$this->miennes->id])->and($reponse->getContent())->not->toContain($this->siennes->reference);
    $this->getJson("/api/v1/marketplace/bookings/{$this->miennes->id}")->assertOk()->assertJsonPath('data.reference', $this->miennes->reference);
});

it('pagine par curseur et filtre par statut', function (): void {
    $this->actingAs($this->moi);
    $ids = [$this->miennes->id];
    foreach (['2027-01-10', '2027-01-20'] as $debut) {
        $ids[] = B::reservation($this->org, $this->annonce, $this->moi->id, ['check_in' => $debut, 'check_out' => CarbonImmutable::parse($debut)->addDays(2)->toDateString()])->id;
    }

    $p1 = $this->getJson('/api/v1/marketplace/bookings?per_page=2')->assertOk();
    $p2 = $this->getJson('/api/v1/marketplace/bookings?per_page=2&cursor='.$p1->json('meta.next_cursor'))->assertOk();

    expect([...$p1->json('data.*.id'), ...$p2->json('data.*.id')])->toBe(array_reverse($ids))->and($p2->json('meta.has_more'))->toBeFalse();
    $this->getJson('/api/v1/marketplace/bookings?status=pending_payment')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/api/v1/marketplace/bookings?status=nimporte')->assertUnprocessable();
    $this->getJson('/api/v1/marketplace/bookings?cursor=zzz')->assertUnprocessable();
});

it('n\'expose jamais l\'identifiant du compte ni celui de l\'organisation au voyageur', function (): void {
    $this->actingAs($this->moi);

    $corps = $this->getJson("/api/v1/marketplace/bookings/{$this->miennes->id}")->assertOk()->getContent();

    expect($corps)->not->toContain($this->moi->id)->not->toContain($this->org->id)->not->toContain($this->annonce->id);
});

describe('côté organisation', function (): void {
    it('liste les réservations des annonces de l\'organisation, avec le prénom du voyageur seulement', function (): void {
        $this->moi->forceFill(['name' => 'Camille Zorglub'])->save();
        $this->actingAs(C::titulaire($this->org));

        $reponse = $this->getJson(C::url($this->org, '/bookings'))->assertOk();

        expect($reponse->json('data.*.id'))->toBe([$this->siennes->id, $this->miennes->id])
            ->and(collect($reponse->json('data'))->firstWhere('id', $this->miennes->id)['traveler'])->toBe(['first_name' => 'Camille'])
            ->and($reponse->getContent())->not->toContain($this->moi->id)->not->toContain($this->moi->email)->not->toContain('Zorglub');
    });

    it('n\'expose rien d\'une autre organisation', function (): void {
        $autreOrg = C::organisation();
        $annonceEtrangere = M::annonce($autreOrg);
        $etrangere = B::reservation($autreOrg, $annonceEtrangere, $this->moi->id, ['check_in' => '2026-12-10', 'check_out' => '2026-12-12']);

        C::changerDeCompte($this, C::titulaire($this->org));
        $ids = $this->getJson(C::url($this->org, '/bookings'))->assertOk()->json('data.*.id');
        expect($ids)->not->toContain($etrangere->id)->and($ids)->toHaveCount(2);

        $this->getJson(C::url($autreOrg, '/bookings'))->assertNotFound()->assertJsonPath('code', 'organization_not_found');

        C::changerDeCompte($this, C::titulaire($autreOrg));
        expect($this->getJson(C::url($autreOrg, '/bookings'))->assertOk()->json('data.*.id'))->toBe([$etrangere->id]);
    });

    it('exige un jeton et un rôle owner, admin ou manager', function (): void {
        auth()->forgetGuards();
        $this->getJson(C::url($this->org, '/bookings'))->assertUnauthorized();

        C::changerDeCompte($this, C::membre($this->org, MemberRole::Accountant));
        $this->getJson(C::url($this->org, '/bookings'))->assertForbidden()->assertJsonPath('code', 'role_forbidden');

        C::changerDeCompte($this, C::membre($this->org, MemberRole::Manager));
        $this->getJson(C::url($this->org, '/bookings'))->assertOk();

        C::changerDeCompte($this, $this->moi);
        $this->getJson(C::url($this->org, '/bookings'))->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    });
});
