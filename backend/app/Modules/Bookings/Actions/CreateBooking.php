<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Bookings\Data\StayRequestData;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Enums\ErrorCode;
use App\Modules\Bookings\Events\BookingCreated;
use App\Modules\Bookings\Models\Booking;
use App\Modules\Bookings\Queries\Availability;
use App\Modules\Bookings\Queries\BookingLookup;
use App\Modules\Bookings\Support\BookingReference;
use App\Modules\Bookings\Support\StayPricing;
use App\Modules\Listings\PublicApi\ListingDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class CreateBooking
{
    private const int PENDING_PAR_COMPTE = 2;

    private const int PENDING_PAR_ANNONCE = 1;

    public function __construct(
        private ListingDirectory $annonces,
        private StayPricing $tarifs,
        private Availability $disponibilites,
        private BookingLookup $reservations,
        private BookingReference $references,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Les montants viennent de l'annonce, jamais du client. Le verrou de ligne de l'annonce sérialise les réservations concurrentes d'un même
     * logement ; la clé d'idempotence est relue sous ce verrou pour qu'un rejeu simultané rende la réservation déjà créée, avant le contrôle des
     * plafonds de réservations en attente (un rejeu n'en crée pas une de plus).
     *
     * @return array{booking: Booking, replayed: bool}
     */
    public function handle(string $userId, StayRequestData $demande, string $cle): array
    {
        $empreinte = hash('sha256', (string) json_encode([$demande->listingRef, $demande->checkIn, $demande->checkOut, $demande->guests], JSON_THROW_ON_ERROR));

        if (($existante = $this->reservations->byKey($userId, $cle)) !== null) {
            return $this->rejouer($existante, $empreinte);
        }

        try {
            return DB::transaction(fn (): array => $this->creer($userId, $demande, $cle, $empreinte));
        } catch (UniqueConstraintViolationException $erreur) {
            return $this->rejouerApresCourse($userId, $cle, $empreinte, $erreur);
        }
    }

    /**
     * @return array{booking: Booking, replayed: bool}
     */
    private function rejouerApresCourse(string $userId, string $cle, string $empreinte, UniqueConstraintViolationException $erreur): array
    {
        $concurrente = $this->reservations->byKey($userId, $cle);

        if ($concurrente === null) {
            throw $erreur;
        }

        return $this->rejouer($concurrente, $empreinte);
    }

    /**
     * @return array{booking: Booking, replayed: bool}
     */
    private function creer(string $userId, StayRequestData $demande, string $cle, string $empreinte): array
    {
        $annonce = $this->annonces->lockBookable($demande->listingRef);

        if (($existante = $this->reservations->byKey($userId, $cle)) !== null) {
            return $this->rejouer($existante, $empreinte);
        }

        $tarif = $this->tarifs->price($annonce, $demande->checkIn, $demande->checkOut, $demande->guests);
        $maintenant = CarbonImmutable::now();

        if ($this->disponibilites->conflicts($annonce->id, $demande->checkIn, $demande->checkOut, $maintenant, true)) {
            throw ErrorCode::DatesUnavailable->problem();
        }

        $this->enforcePendingCaps($userId, $annonce->id, $maintenant);

        $reference = $this->references->next($maintenant->year);

        $reservation = $this->contexte->run($annonce->organizationId, fn (): Booking => Booking::query()->create([
            'reference' => $reference,
            'listing_id' => $annonce->id,
            'user_id' => $userId,
            'check_in' => $demande->checkIn,
            'check_out' => $demande->checkOut,
            'nights' => $tarif->nights,
            'guests' => $demande->guests,
            'nightly_minor' => $tarif->nightlyMinor,
            'subtotal_minor' => $tarif->subtotalMinor,
            'service_fee_minor' => $tarif->serviceFeeMinor,
            'total_minor' => $tarif->totalMinor,
            'currency' => $tarif->currency,
            'cancellation_policy' => $tarif->cancellationPolicy,
            'status' => BookingStatus::PendingPayment,
            'expires_at' => $maintenant->addMinutes($this->delaiDePaiement()),
            'idempotency_key' => $cle,
            'fingerprint' => $empreinte,
        ]));

        BookingCreated::dispatch($reservation->id, $reservation->organization_id, $annonce->id, $userId);

        return ['booking' => $reservation, 'replayed' => false];
    }

    private function enforcePendingCaps(string $userId, string $listingId, CarbonImmutable $maintenant): void
    {
        if ($this->reservations->livePendingCount($userId, $maintenant, $listingId) >= self::PENDING_PAR_ANNONCE) {
            throw ErrorCode::PendingBookingExists->problem();
        }

        if ($this->reservations->livePendingCount($userId, $maintenant) >= self::PENDING_PAR_COMPTE) {
            throw ErrorCode::TooManyPendingBookings->problem();
        }
    }

    /**
     * @return array{booking: Booking, replayed: bool}
     */
    private function rejouer(Booking $existante, string $empreinte): array
    {
        if (! hash_equals($existante->fingerprint, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return ['booking' => $existante, 'replayed' => true];
    }

    private function delaiDePaiement(): int
    {
        $minutes = config('marketplace.pending_payment_minutes');

        return is_int($minutes) && $minutes > 0 ? $minutes : 30;
    }
}
