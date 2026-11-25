<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Shared\Reminders\ReminderHit;
use App\Shared\Reminders\ReminderWindow;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

/**
 * Déclencheurs de rappel au locataire (ADR 0042) ; départ : la date d'échéance.
 */
final class ReminderTargets
{
    /**
     * @return iterable<ReminderHit>
     */
    public function dueSoon(ReminderWindow $fenetre): iterable
    {
        return $this->unsettled([InstallmentStatus::Upcoming, ...InstallmentStatus::open()], $fenetre);
    }

    /**
     * @return iterable<ReminderHit>
     */
    public function unpaid(ReminderWindow $fenetre): iterable
    {
        return $this->unsettled(InstallmentStatus::open(), $fenetre);
    }

    /**
     * @param  list<InstallmentStatus>  $statuts
     * @return iterable<ReminderHit>
     */
    private function unsettled(array $statuts, ReminderWindow $fenetre): iterable
    {
        return AcrossOrganizations::query(Installment::class)
            ->whereIn('status', array_map(fn (InstallmentStatus $statut): string => $statut->value, $statuts))
            ->where('due_date', '>=', $fenetre->from->toDateString())
            ->where('due_date', '<', $fenetre->to->addDay()->toDateString())
            ->select(['id', 'organization_id', 'lease_id', 'due_date'])->lazyById(500)
            ->map(fn (Installment $echeance): ReminderHit => new ReminderHit(
                $echeance->id,
                CarbonImmutable::parse($echeance->due_date->toDateString()),
                organizationId: $echeance->organization_id,
                leaseId: $echeance->lease_id,
                params: ['date' => $echeance->due_date->toDateString()],
            ));
    }
}
