<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Models\RentSchedule;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Str;

/**
 * Verrou d'ordre par bail : toute Action qui touche aux échéances ou aux encaissements d'un bail commence par lui,
 * avant toute lecture non verrouillante, puis verrouille les échéances dans l'ordre (échéance, période, identifiant).
 */
final class Schedules
{
    public function assertBillable(LeaseBillingData $bail): void
    {
        if ($bail->status !== LeaseStatus::Signed && $bail->status !== LeaseStatus::Terminated) {
            throw ErrorCode::LeaseNotBillable->problem();
        }
    }

    /**
     * Crée l'échéancier du bail s'il n'existe pas : un bail dont la date de début est passée se facture à partir de la
     * période courante, jamais en rattrapage. Le verrou reste tenu jusqu'à la fin de la transaction de l'appelant.
     */
    public function locked(LeaseBillingData $bail, CarbonImmutable $today): RentSchedule
    {
        $existant = $this->lock($bail->leaseId);

        if ($existant !== null) {
            return $existant;
        }

        $depart = CarbonImmutable::parse($bail->startsOn)->startOfDay();
        $depart = $depart->greaterThan($today) ? $depart : $today;

        try {
            RentSchedule::query()->create(['lease_id' => $bail->leaseId, 'billing_from' => BillingCalendar::firstOfMonth($depart)->toDateString()]);
        } catch (UniqueConstraintViolationException $erreur) {
            return $this->lock($bail->leaseId) ?? throw $erreur;
        }

        return $this->lock($bail->leaseId) ?? throw ErrorCode::LeaseNotBillable->problem();
    }

    public function lockExisting(string $leaseId): RentSchedule
    {
        return $this->lock($leaseId) ?? throw ErrorCode::InstallmentNotFound->problem();
    }

    private function lock(string $leaseId): ?RentSchedule
    {
        return Str::isUuid($leaseId) ? RentSchedule::query()->where('lease_id', $leaseId)->lockForUpdate()->first() : null;
    }
}
