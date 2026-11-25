<?php

declare(strict_types=1);

use App\Modules\Bookings\Actions\ConfirmBooking;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Events\BookingCancelled;
use App\Modules\Bookings\Events\BookingConfirmed;
use App\Modules\Bookings\Models\Booking;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Bookings\BookingsContext as B;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    M::semer();
    $this->travelTo(B::AUJOURDHUI);
    $this->org = C::organisation();
    $this->annonce = M::annonce($this->org);
    $this->moi = M::voyageur();
});

function statutEnBase(string $id): BookingStatus
{
    return AcrossOrganizations::query(Booking::class)->findOrFail($id)->status;
}

it('expire au bout de 30 minutes les réservations non payées, et seulement celles-là', function (): void {
    Event::fake([BookingCancelled::class]);
    $perimee = B::enAttente($this->org, $this->annonce, $this->moi->id, ['expires_at' => now()->subMinute(), 'check_in' => '2026-12-01', 'check_out' => '2026-12-03']);
    $enCours = B::enAttente($this->org, $this->annonce, $this->moi->id, ['expires_at' => now()->addMinutes(5), 'check_in' => '2026-12-05', 'check_out' => '2026-12-07']);
    $confirmee = B::reservation($this->org, $this->annonce, $this->moi->id, ['check_in' => '2026-12-10', 'check_out' => '2026-12-12']);

    $this->artisan('bookings:sweep')->expectsOutputToContain('1 réservation(s) expirée(s)')->assertSuccessful();

    $expiree = AcrossOrganizations::query(Booking::class)->findOrFail($perimee->id);
    expect($expiree->status)->toBe(BookingStatus::Cancelled)->and($expiree->cancel_reason)->toBe('payment_expired')->and($expiree->refund_minor)->toBe(0)->and($expiree->cancelled_at)->not->toBeNull()
        ->and(statutEnBase($enCours->id))->toBe(BookingStatus::PendingPayment)
        ->and(statutEnBase($confirmee->id))->toBe(BookingStatus::Confirmed);
    Event::assertDispatchedTimes(BookingCancelled::class, 1);

    $this->artisan('bookings:sweep')->expectsOutputToContain('0 réservation(s) expirée(s)')->assertSuccessful();
});

it('expire une réservation créée par l\'API après 30 minutes réelles', function (): void {
    $this->actingAs($this->moi);
    $id = $this->postJson('/api/v1/marketplace/bookings', B::corps($this->annonce), ['Idempotency-Key' => 'cle-expiration-1'])->assertCreated()->json('data.id');

    $this->travelTo(now()->addMinutes(29));
    $this->artisan('bookings:sweep')->assertSuccessful();
    expect(statutEnBase($id))->toBe(BookingStatus::PendingPayment);

    $this->travelTo(now()->addMinutes(2));
    $this->artisan('bookings:sweep')->assertSuccessful();
    expect(statutEnBase($id))->toBe(BookingStatus::Cancelled);
});

it('termine les séjours confirmés dont le départ est passé', function (): void {
    $passee = B::reservation($this->org, $this->annonce, $this->moi->id, ['check_in' => '2026-11-10', 'check_out' => '2026-11-14']);
    $departAujourdhui = B::reservation($this->org, $this->annonce, $this->moi->id, ['check_in' => '2026-11-18', 'check_out' => '2026-11-21']);
    $enCours = B::reservation($this->org, $this->annonce, $this->moi->id, ['check_in' => '2026-11-19', 'check_out' => '2026-11-23']);
    $future = B::reservation($this->org, $this->annonce, $this->moi->id, ['check_in' => '2026-12-10', 'check_out' => '2026-12-12']);
    $nonPayee = B::enAttente($this->org, $this->annonce, $this->moi->id, ['check_in' => '2026-12-20', 'check_out' => '2026-12-22']);

    $this->artisan('bookings:sweep')->expectsOutputToContain('2 séjour(s) terminé(s)')->assertSuccessful();

    expect(statutEnBase($passee->id))->toBe(BookingStatus::Completed)
        ->and(statutEnBase($departAujourdhui->id))->toBe(BookingStatus::Completed)
        ->and(statutEnBase($enCours->id))->toBe(BookingStatus::Confirmed)
        ->and(statutEnBase($future->id))->toBe(BookingStatus::Confirmed)
        ->and(statutEnBase($nonPayee->id))->toBe(BookingStatus::PendingPayment);
});

it('figure au planificateur chaque minute', function (): void {
    $planifiees = collect(app(Schedule::class)->events())->filter(fn ($e): bool => str_contains((string) $e->command, 'bookings:sweep'));

    expect($planifiees)->toHaveCount(1)->and($planifiees->first()->expression)->toBe('* * * * *');
});

describe('ConfirmBooking', function (): void {
    it('confirme une réservation en attente et prévient par événement', function (): void {
        Event::fake([BookingConfirmed::class]);
        $reservation = B::enAttente($this->org, $this->annonce, $this->moi->id);

        $confirmee = app(ConfirmBooking::class)->handle($reservation->id);

        expect($confirmee->status)->toBe(BookingStatus::Confirmed)->and($confirmee->confirmed_at)->not->toBeNull()->and($confirmee->expires_at)->toBeNull()
            ->and(statutEnBase($reservation->id))->toBe(BookingStatus::Confirmed);
        Event::assertDispatched(BookingConfirmed::class, fn (BookingConfirmed $e): bool => $e->bookingId === $reservation->id && $e->userId === $this->moi->id);
    });

    it('est rejouable sans nouvel événement', function (): void {
        Event::fake([BookingConfirmed::class]);
        $reservation = B::enAttente($this->org, $this->annonce, $this->moi->id);

        app(ConfirmBooking::class)->handle($reservation->id);
        app(ConfirmBooking::class)->handle($reservation->id);

        Event::assertDispatchedTimes(BookingConfirmed::class, 1);
    });

    it('refuse une réservation expirée ou annulée', function (BookingStatus $statut): void {
        $reservation = B::reservation($this->org, $this->annonce, $this->moi->id, ['status' => $statut, 'cancelled_at' => now()]);
        $perimee = B::enAttente($this->org, $this->annonce, $this->moi->id, ['expires_at' => now()->subMinute(), 'check_in' => '2026-12-01', 'check_out' => '2026-12-03']);

        expect(fn () => app(ConfirmBooking::class)->handle($reservation->id))->toThrow(fn (ApiProblem $p): bool => $p->problemCode === 'booking_not_confirmable')
            ->and(fn () => app(ConfirmBooking::class)->handle($perimee->id))->toThrow(fn (ApiProblem $p): bool => $p->problemCode === 'booking_not_confirmable');
        expect(statutEnBase($perimee->id))->toBe(BookingStatus::PendingPayment);
    })->with([BookingStatus::Cancelled, BookingStatus::Completed]);

    it('n\'a aucune route publique', function (): void {
        $routes = collect(app('router')->getRoutes()->getRoutes())->filter(fn ($r): bool => str_starts_with((string) $r->getName(), 'bookings.') && (str_contains($r->uri(), 'confirm') || str_contains((string) $r->getName(), 'confirm')));

        expect($routes)->toHaveCount(0)->and(app('router')->getRoutes()->getByName('bookings.confirm'))->toBeNull();
    });
});
