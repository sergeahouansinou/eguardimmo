<?php

declare(strict_types=1);

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Identity\Models\User;
use App\Modules\Listings\Enums\ListingStatus;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Bookings\BookingsContext as B;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    M::semer();
    $this->travelTo(B::AUJOURDHUI);
    $this->org = C::organisation();
    $this->annonce = M::annonce($this->org, ['price_minor' => 9000, 'capacity' => 4, 'min_nights' => 2]);
    $this->moi = M::voyageur();
    $this->actingAs($this->moi);
});

function reserver(array $corps, string $cle = 'cle-reservation-1'): TestResponse
{
    return test()->postJson('/api/v1/marketplace/bookings', $corps, ['Idempotency-Key' => $cle]);
}

it('crée une réservation en attente de paiement, tarifée par le serveur', function (): void {
    $reponse = reserver(B::corps($this->annonce))->assertCreated();
    $data = $reponse->json('data');

    expect($data['status'])->toBe('pending_payment')
        ->and($data['payment'])->toBe('to_finalize')
        ->and($data['reference'])->toBe('SB-2026-000001')
        ->and($data['nights'])->toBe(3)
        ->and($data['nightly'])->toBe(['amount' => 9000, 'currency' => 'EUR'])
        ->and($data['subtotal']['amount'])->toBe(27000)
        ->and($data['service_fee']['amount'])->toBe(0)
        ->and($data['total'])->toBe(['amount' => 27000, 'currency' => 'EUR'])
        ->and($data['listing']['ref'])->toBe($this->annonce->public_ref)
        ->and($data['listing']['host'])->toBe(['name' => 'Agence du Port'])
        ->and($data['refund'])->toBeNull()
        ->and(CarbonImmutable::parse($data['expires_at'])->equalTo(now()->addMinutes(30)))->toBeTrue();

    $enBase = AcrossOrganizations::query(Booking::class)->findOrFail($data['id']);
    expect($enBase->user_id)->toBe($this->moi->id)->and($enBase->organization_id)->toBe($this->org->id)->and($enBase->status)->toBe(BookingStatus::PendingPayment);
});

it('ne confirme jamais sans paiement', function (): void {
    reserver(B::corps($this->annonce))->assertCreated();

    expect(AcrossOrganizations::query(Booking::class)->where('status', 'confirmed')->count())->toBe(0);
});

it('applique les frais de service configurés sur le sous-total', function (): void {
    config(['marketplace.service_fee_basis_points' => 250]);

    $data = reserver(B::corps($this->annonce))->assertCreated()->json('data');

    expect($data['subtotal']['amount'])->toBe(27000)->and($data['service_fee']['amount'])->toBe(675)->and($data['total']['amount'])->toBe(27675);
});

it('ignore prix, montants, statut, compte et organisation envoyés par le client', function (): void {
    $autre = C::organisation();

    $data = reserver(B::corps($this->annonce, [
        'nightly_minor' => 1, 'subtotal_minor' => 1, 'total_minor' => 1, 'total' => 1, 'status' => 'confirmed', 'user_id' => (string) fake()->uuid(),
        'organization_id' => $autre->id, 'nights' => 1, 'currency' => 'XOF', 'reference' => 'SB-1999-000001', 'cancellation_policy' => 'flexible',
    ]))->assertCreated()->json('data');

    $enBase = AcrossOrganizations::query(Booking::class)->findOrFail($data['id']);
    expect($enBase->total_minor)->toBe(27000)->and($enBase->status)->toBe(BookingStatus::PendingPayment)->and($enBase->user_id)->toBe($this->moi->id)
        ->and($enBase->organization_id)->toBe($this->org->id)->and($enBase->nights)->toBe(3)->and($enBase->currency)->toBe('EUR')
        ->and($enBase->reference)->toBe('SB-2026-000001')->and($enBase->cancellation_policy->value)->toBe('moderate');
});

it('exige un compte connecté et un e-mail vérifié', function (): void {
    auth()->forgetGuards();
    reserver(B::corps($this->annonce))->assertUnauthorized();

    $this->actingAs(User::factory()->unverified()->create());
    reserver(B::corps($this->annonce))->assertForbidden()->assertJsonPath('code', 'email_unverified');
    expect(AcrossOrganizations::query(Booking::class)->count())->toBe(0);
});

it('numérote sans trou par année et repart à 1 l\'année suivante', function (): void {
    $refs = [];
    foreach (['2026-12-01', '2026-12-05', '2026-12-09'] as $i => $arrivee) {
        $this->actingAs(M::voyageur());
        $refs[] = reserver(B::corps($this->annonce, ['check_in' => $arrivee, 'check_out' => CarbonImmutable::parse($arrivee)->addDays(2)->toDateString()]), "cle-numero-{$i}")->assertCreated()->json('data.reference');
    }

    $this->travelTo('2027-01-05 10:00:00');
    $refs[] = reserver(B::corps($this->annonce, ['check_in' => '2027-02-01', 'check_out' => '2027-02-03']), 'cle-numero-9')->assertCreated()->json('data.reference');

    expect($refs)->toBe(['SB-2026-000001', 'SB-2026-000002', 'SB-2026-000003', 'SB-2027-000001']);
});

it('ne consomme aucun numéro quand la réservation est refusée', function (): void {
    reserver(B::corps($this->annonce, ['guests' => 9]), 'cle-refus-1')->assertUnprocessable();

    reserver(B::corps($this->annonce), 'cle-refus-2')->assertCreated()->assertJsonPath('data.reference', 'SB-2026-000001');
});

describe('idempotence', function (): void {
    it('exige l\'en-tête Idempotency-Key', function (string $cle): void {
        $this->postJson('/api/v1/marketplace/bookings', B::corps($this->annonce), $cle === '' ? [] : ['Idempotency-Key' => $cle])
            ->assertUnprocessable()->assertJsonPath('code', 'bookings_idempotency_key_required');
        expect(AcrossOrganizations::query(Booking::class)->count())->toBe(0);
    })->with(['absente' => '', 'trop courte' => 'abc', 'caractères interdits' => 'cle avec espace !']);

    it('rejoue la même demande sans doublon', function (): void {
        $premiere = reserver(B::corps($this->annonce))->assertCreated();
        $seconde = reserver(B::corps($this->annonce))->assertOk();

        expect($seconde->json('data.id'))->toBe($premiere->json('data.id'))->and(AcrossOrganizations::query(Booking::class)->count())->toBe(1);
    });

    it('refuse la même clé pour une demande différente', function (): void {
        reserver(B::corps($this->annonce))->assertCreated();

        reserver(B::corps($this->annonce, ['check_out' => '2026-12-14']))->assertConflict()->assertJsonPath('code', 'idempotency_key_reused');
        expect(AcrossOrganizations::query(Booking::class)->count())->toBe(1);
    });

    it('rend la réservation déjà créée même si les dates sont désormais prises par elle-même', function (): void {
        $premiere = reserver(B::corps($this->annonce))->assertCreated();

        reserver(B::corps($this->annonce))->assertOk()->assertJsonPath('data.reference', $premiere->json('data.reference'));
    });

    it('isole les clés par compte', function (): void {
        reserver(B::corps($this->annonce), 'cle-commune-1')->assertCreated();

        $this->actingAs(M::voyageur());
        reserver(B::corps($this->annonce, ['check_in' => '2026-12-20', 'check_out' => '2026-12-22']), 'cle-commune-1')->assertCreated();
        expect(AcrossOrganizations::query(Booking::class)->count())->toBe(2);
    });
});

describe('disponibilité', function (): void {
    it('refuse tout chevauchement avec une réservation en attente non expirée', function (string $arrivee, string $depart): void {
        reserver(B::corps($this->annonce))->assertCreated();

        $this->actingAs(M::voyageur());
        reserver(B::corps($this->annonce, ['check_in' => $arrivee, 'check_out' => $depart]), 'cle-autre-voyageur')->assertConflict()->assertJsonPath('code', 'dates_unavailable');
        expect(AcrossOrganizations::query(Booking::class)->count())->toBe(1);
    })->with([
        'mêmes dates' => ['2026-12-10', '2026-12-13'],
        'arrivée dans le séjour' => ['2026-12-12', '2026-12-15'],
        'départ dans le séjour' => ['2026-12-08', '2026-12-11'],
        'séjour englobant' => ['2026-12-08', '2026-12-20'],
        'séjour englobé' => ['2026-12-11', '2026-12-13'],
        'une nuit en commun' => ['2026-12-12', '2026-12-14'],
    ]);

    it('accepte un séjour qui commence le jour du départ ou finit le jour de l\'arrivée', function (string $arrivee, string $depart): void {
        reserver(B::corps($this->annonce))->assertCreated();

        $this->actingAs(M::voyageur());
        reserver(B::corps($this->annonce, ['check_in' => $arrivee, 'check_out' => $depart]), 'cle-autre-voyageur')->assertCreated();
    })->with([
        'départ exclusif' => ['2026-12-13', '2026-12-16'],
        'arrivée du suivant' => ['2026-12-08', '2026-12-10'],
    ]);

    it('refuse aussi une réservation confirmée, ou terminée', function (BookingStatus $statut): void {
        B::reservation($this->org, $this->annonce, (string) fake()->uuid(), ['status' => $statut, 'check_in' => '2026-12-10', 'check_out' => '2026-12-13']);

        reserver(B::corps($this->annonce, ['check_in' => '2026-12-11', 'check_out' => '2026-12-13']))->assertConflict()->assertJsonPath('code', 'dates_unavailable');
    })->with([BookingStatus::Confirmed, BookingStatus::Completed]);

    it('ignore une réservation annulée ou en attente expirée', function (): void {
        B::reservation($this->org, $this->annonce, (string) fake()->uuid(), ['status' => BookingStatus::Cancelled, 'cancelled_at' => now(), 'check_in' => '2026-12-10', 'check_out' => '2026-12-13']);
        B::enAttente($this->org, $this->annonce, (string) fake()->uuid(), ['expires_at' => now()->subMinute(), 'check_in' => '2026-12-10', 'check_out' => '2026-12-13']);

        reserver(B::corps($this->annonce))->assertCreated();
    });

    it('n\'est pas bloquée par les réservations d\'une autre annonce', function (): void {
        $autre = M::annonce($this->org, ['price_minor' => 5000]);
        B::reservation($this->org, $autre, (string) fake()->uuid(), ['check_in' => '2026-12-10', 'check_out' => '2026-12-13']);

        reserver(B::corps($this->annonce))->assertCreated();
    });

    it('libère les dates quand le délai de paiement est dépassé', function (): void {
        reserver(B::corps($this->annonce))->assertCreated();
        $this->travelTo(now()->addMinutes(31));

        $this->actingAs(M::voyageur());
        reserver(B::corps($this->annonce, ['check_in' => '2026-12-10', 'check_out' => '2026-12-13']), 'cle-apres-delai')->assertCreated();
    });
});

describe('règles du séjour', function (): void {
    it('refuse un séjour invalide', function (array $corps, string $code): void {
        reserver(B::corps($this->annonce, $corps))->assertStatus(422)->assertJsonPath('code', $code);
    })->with([
        'arrivée passée' => [['check_in' => '2026-11-20', 'check_out' => '2026-11-23'], 'validation_failed'],
        'départ avant arrivée' => [['check_in' => '2026-12-10', 'check_out' => '2026-12-09'], 'validation_failed'],
        'départ égal à l\'arrivée' => [['check_in' => '2026-12-10', 'check_out' => '2026-12-10'], 'validation_failed'],
        'date mal formée' => [['check_in' => '10/12/2026'], 'validation_failed'],
        'zéro voyageur' => [['guests' => 0], 'validation_failed'],
        'référence mal formée' => [['listing_ref' => 'ABC'], 'validation_failed'],
        'sous le minimum de nuits' => [['check_in' => '2026-12-10', 'check_out' => '2026-12-11'], 'min_nights_not_met'],
        'plus de 90 nuits' => [['check_in' => '2026-12-01', 'check_out' => '2027-03-05'], 'stay_too_long'],
        'trop de voyageurs' => [['guests' => 5], 'guests_exceed_capacity'],
    ]);

    it('accepte une arrivée aujourd\'hui', function (): void {
        reserver(B::corps($this->annonce, ['check_in' => '2026-11-21', 'check_out' => '2026-11-23']))->assertCreated();
    });

    it('refuse un logement de longue durée, un brouillon, une annonce archivée ou inconnue', function (): void {
        $long = M::annonce($this->org, ['kind' => 'long_term', 'price_unit' => 'month']);
        $brouillon = M::annonce($this->org, [], ListingStatus::Draft);
        $archivee = M::annonce($this->org, [], ListingStatus::Archived);

        reserver(B::corps($long))->assertUnprocessable()->assertJsonPath('code', 'listing_not_bookable');
        reserver(B::corps($brouillon))->assertNotFound()->assertJsonPath('code', 'listing_not_found');
        reserver(B::corps($archivee))->assertNotFound();
        reserver(B::corps($this->annonce, ['listing_ref' => 'abcdefghjkmn']))->assertNotFound();
    });
});
