<?php

declare(strict_types=1);

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Events\BookingCancelled;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Listings\Enums\CancellationPolicy;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Bookings\BookingsContext as B;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    M::semer();
    $this->travelTo(B::AUJOURDHUI);
    $this->org = C::organisation();
    $this->annonce = M::annonce($this->org);
    $this->moi = M::voyageur();
    $this->actingAs($this->moi);
});

function annulerReservation(string $id): TestResponse
{
    return test()->postJson("/api/v1/marketplace/bookings/{$id}/cancel");
}

it('rembourse selon la politique figée à la réservation, par nombre de jours avant l\'arrivée', function (CancellationPolicy $politique, int $jours, int $pourcent): void {
    $arrivee = now()->startOfDay()->addDays($jours);
    $reservation = B::reservation($this->org, $this->annonce, $this->moi->id, [
        'cancellation_policy' => $politique, 'check_in' => $arrivee->toDateString(), 'check_out' => $arrivee->addDays(3)->toDateString(), 'total_minor' => 27000, 'subtotal_minor' => 27000,
    ]);

    $reponse = annulerReservation($reservation->id)->assertOk();

    expect($reponse->json('data.status'))->toBe('cancelled')
        ->and($reponse->json('data.refund'))->toBe(['amount' => intdiv(27000 * $pourcent, 100), 'currency' => 'EUR'])
        ->and($reponse->json('data.cancel_reason'))->toBe('traveler_cancelled')
        ->and($reponse->json('data.cancelled_at'))->not->toBeNull();
})->with([
    'flexible, 2 jours' => [CancellationPolicy::Flexible, 2, 100],
    'flexible, 1 jour' => [CancellationPolicy::Flexible, 1, 100],
    'moderate, 10 jours' => [CancellationPolicy::Moderate, 10, 100],
    'moderate, 5 jours' => [CancellationPolicy::Moderate, 5, 100],
    'moderate, 4 jours' => [CancellationPolicy::Moderate, 4, 0],
    'moderate, 1 jour' => [CancellationPolicy::Moderate, 1, 0],
    'strict, 30 jours' => [CancellationPolicy::Strict, 30, 50],
    'strict, 7 jours' => [CancellationPolicy::Strict, 7, 50],
    'strict, 6 jours' => [CancellationPolicy::Strict, 6, 0],
    'strict, 1 jour' => [CancellationPolicy::Strict, 1, 0],
]);

it('applique la politique de la réservation, pas celle que l\'annonce a aujourd\'hui', function (): void {
    $reservation = B::reservation($this->org, $this->annonce, $this->moi->id, ['cancellation_policy' => CancellationPolicy::Flexible, 'check_in' => '2026-11-25', 'check_out' => '2026-11-27']);
    C::dans($this->org, fn () => $this->annonce->forceFill(['cancellation_policy' => CancellationPolicy::Strict])->save());

    annulerReservation($reservation->id)->assertOk()->assertJsonPath('data.refund.amount', 27000);
});

it('n\'annonce aucun remboursement pour une réservation jamais payée', function (): void {
    $reservation = B::enAttente($this->org, $this->annonce, $this->moi->id, ['check_in' => '2026-12-20', 'check_out' => '2026-12-23']);

    annulerReservation($reservation->id)->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.refund.amount', 0);
});

it('libère les dates et émet un événement', function (): void {
    Event::fake([BookingCancelled::class]);
    $reservation = B::reservation($this->org, $this->annonce, $this->moi->id, ['check_in' => '2026-12-20', 'check_out' => '2026-12-23']);

    annulerReservation($reservation->id)->assertOk();

    Event::assertDispatched(BookingCancelled::class, fn (BookingCancelled $e): bool => $e->bookingId === $reservation->id && $e->reason === 'traveler_cancelled' && $e->refundMinor === 27000);
    $this->postJson('/api/v1/marketplace/bookings', B::corps($this->annonce, ['check_in' => '2026-12-20', 'check_out' => '2026-12-23']), ['Idempotency-Key' => 'cle-apres-annulation'])->assertCreated();
});

it('refuse d\'annuler quand le séjour a commencé, est terminé ou déjà annulé', function (BookingStatus $statut, string $arrivee, string $depart): void {
    $reservation = B::reservation($this->org, $this->annonce, $this->moi->id, [
        'status' => $statut, 'check_in' => $arrivee, 'check_out' => $depart, 'cancelled_at' => $statut === BookingStatus::Cancelled ? now() : null,
    ]);

    annulerReservation($reservation->id)->assertConflict()->assertJsonPath('code', 'booking_not_cancellable');
    expect(AcrossOrganizations::query(Booking::class)->findOrFail($reservation->id)->status)->toBe($statut);
})->with([
    'arrivée aujourd\'hui' => [BookingStatus::Confirmed, '2026-11-21', '2026-11-24'],
    'séjour en cours' => [BookingStatus::Confirmed, '2026-11-19', '2026-11-24'],
    'séjour passé' => [BookingStatus::Confirmed, '2026-11-01', '2026-11-04'],
    'déjà annulée' => [BookingStatus::Cancelled, '2026-12-20', '2026-12-23'],
    'terminée' => [BookingStatus::Completed, '2026-12-20', '2026-12-23'],
]);

it('une seconde annulation ne rembourse pas deux fois', function (): void {
    $reservation = B::reservation($this->org, $this->annonce, $this->moi->id, ['check_in' => '2026-12-20', 'check_out' => '2026-12-23']);

    annulerReservation($reservation->id)->assertOk();
    annulerReservation($reservation->id)->assertConflict();
    expect(AcrossOrganizations::query(Booking::class)->findOrFail($reservation->id)->refund_minor)->toBe(27000);
});
