<?php

declare(strict_types=1);

namespace App\Modules\Bookings\Actions;

use App\Modules\Bookings\Enums\BookingStatus;
use App\Modules\Bookings\Queries\BookingLookup;
use App\Modules\Bookings\Support\Calendar;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class CompleteElapsedBookings
{
    private const int LOT = 500;

    public function __construct(
        private BookingLookup $reservations,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Une réservation confirmée dont le départ est passé devient terminée.
     *
     * @return int nombre de réservations terminées
     */
    public function handle(): int
    {
        $aujourdhui = Calendar::today()->toDateString();
        $terminees = 0;

        foreach ($this->reservations->elapsedConfirmed($aujourdhui, self::LOT) as $cible) {
            $terminees += $this->contexte->run($cible['organization_id'], fn (): int => DB::transaction(function () use ($cible, $aujourdhui): int {
                $reservation = $this->reservations->byId($cible['id'], true);

                if ($reservation->status !== BookingStatus::Confirmed || $reservation->check_out > $aujourdhui) {
                    return 0;
                }

                $reservation->forceFill(['status' => BookingStatus::Completed])->save();

                return 1;
            }));
        }

        return $terminees;
    }
}
