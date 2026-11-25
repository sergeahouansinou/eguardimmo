<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Queries;

use App\Modules\Bookings\Data\OccupiedRangeData;
use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Models\Booking;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Une plage est prise par une réservation confirmée ou terminée, ou en attente de paiement dont le délai court encore. Le départ est exclusif :
 * un départ le jour d'une arrivée ne chevauche pas.
 */
final class Availability
{
    public function conflicts(string $listingId, string $arrivee, string $depart, CarbonImmutable $now, bool $verrou = false): bool
    {
        $requete = $this->blocking($listingId, $now)->where('check_in', '<', $depart)->where('check_out', '>', $arrivee);

        return $verrou ? $requete->lockForUpdate()->value('id') !== null : $requete->exists();
    }

    /**
     * Plages occupées sans aucune identité : ni voyageur, ni référence, ni statut.
     *
     * @return list<OccupiedRangeData>
     */
    public function occupied(string $listingId, string $debut, string $fin, CarbonImmutable $now): array
    {
        $plages = $this->blocking($listingId, $now)
            ->where('check_in', '<', $fin)
            ->where('check_out', '>', $debut)
            ->orderBy('check_in')
            ->get(['check_in', 'check_out'])
            ->map(fn (Booking $b): OccupiedRangeData => new OccupiedRangeData($b->check_in, $b->check_out));

        return array_values($plages->all());
    }

    /**
     * @return Builder<Booking>
     */
    private function blocking(string $listingId, CarbonImmutable $now): Builder
    {
        return AcrossOrganizations::query(Booking::class)
            ->where('listing_id', $listingId)
            ->where(fn (Builder $q) => $q
                ->whereIn('status', [BookingStatus::Confirmed->value, BookingStatus::Completed->value])
                ->orWhere(fn (Builder $p) => $p->where('status', BookingStatus::PendingPayment->value)->where('expires_at', '>', $now)));
    }
}
