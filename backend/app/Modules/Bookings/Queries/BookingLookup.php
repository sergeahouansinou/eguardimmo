<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Queries;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Enums\ErrorCode;
use App\Modules\Bookings\Models\Booking;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Accès aux réservations hors contexte d'organisation : le voyageur, le balayage planifié et la confirmation de paiement n'en ont pas.
 */
final class BookingLookup
{
    /**
     * La réservation d'un autre voyageur est introuvable, au même titre qu'une réservation inconnue.
     */
    public function owned(string $userId, string $id, bool $verrou = false): Booking
    {
        $requete = AcrossOrganizations::query(Booking::class)->where('user_id', $userId);

        if ($verrou) {
            $requete->lockForUpdate();
        }

        return (Str::isUuid($id) ? $requete->whereKey($id)->first() : null) ?? throw ErrorCode::BookingNotFound->problem();
    }

    public function byId(string $id, bool $verrou = false): Booking
    {
        $requete = AcrossOrganizations::query(Booking::class);

        if ($verrou) {
            $requete->lockForUpdate();
        }

        return (Str::isUuid($id) ? $requete->whereKey($id)->first() : null) ?? throw ErrorCode::BookingNotFound->problem();
    }

    public function byKey(string $userId, string $cle): ?Booking
    {
        return AcrossOrganizations::query(Booking::class)->where('user_id', $userId)->where('idempotency_key', $cle)->first();
    }

    /**
     * Réservations en attente de paiement dont le délai court encore ; le plafond ne compte pas celles que le balayage va expirer.
     */
    public function livePendingCount(string $userId, CarbonImmutable $now, ?string $listingId = null): int
    {
        return AcrossOrganizations::query(Booking::class)
            ->where('user_id', $userId)
            ->where('status', BookingStatus::PendingPayment->value)
            ->where('expires_at', '>', $now)
            ->when($listingId !== null, fn (Builder $q) => $q->where('listing_id', $listingId))
            ->count();
    }

    /**
     * @return list<array{id: string, organization_id: string}>
     */
    public function expiredPending(CarbonImmutable $now, int $limite): array
    {
        return $this->targets(BookingStatus::PendingPayment, fn (Builder $q) => $q->where('expires_at', '<=', $now), $limite);
    }

    /**
     * @return list<array{id: string, organization_id: string}>
     */
    public function elapsedConfirmed(string $aujourdhui, int $limite): array
    {
        return $this->targets(BookingStatus::Confirmed, fn (Builder $q) => $q->where('check_out', '<=', $aujourdhui), $limite);
    }

    /**
     * @param  Closure(Builder<Booking>): mixed  $filtre
     * @return list<array{id: string, organization_id: string}>
     */
    private function targets(BookingStatus $statut, Closure $filtre, int $limite): array
    {
        $requete = AcrossOrganizations::query(Booking::class)->where('status', $statut->value);
        $filtre($requete);

        $cibles = $requete->orderBy('id')->limit($limite)->get(['id', 'organization_id'])
            ->map(fn (Booking $b): array => ['id' => $b->id, 'organization_id' => $b->organization_id]);

        return array_values($cibles->all());
    }
}
