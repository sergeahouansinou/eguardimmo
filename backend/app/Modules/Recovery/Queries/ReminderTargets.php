<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Recovery\Enums\CaseStatus;
use App\Modules\Recovery\Models\RecoveryAct;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Shared\Reminders\ReminderHit;
use App\Shared\Reminders\ReminderWindow;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

final class ReminderTargets
{
    /**
     * Dossiers ouverts sans acte récent (ADR 0042) ; départ : le dernier acte, sinon l'ouverture.
     *
     * @return iterable<ReminderHit>
     */
    public function stalledCases(ReminderWindow $fenetre): iterable
    {
        $actes = AcrossOrganizations::query(RecoveryAct::class)->selectRaw('case_id, max(performed_on) as dernier_acte')->groupBy('case_id');

        return AcrossOrganizations::query(RecoveryCase::class)
            ->leftJoinSub($actes, 'actes', 'actes.case_id', '=', 'recovery_cases.id')
            ->where('recovery_cases.status', CaseStatus::Open->value)
            ->whereRaw('coalesce(actes.dernier_acte, recovery_cases.opened_on) >= ?', [$fenetre->from->toDateString()])
            ->whereRaw('coalesce(actes.dernier_acte, recovery_cases.opened_on) < ?', [$fenetre->to->addDay()->toDateString()])
            ->select(['recovery_cases.id', 'recovery_cases.organization_id'])
            ->selectRaw('coalesce(actes.dernier_acte, recovery_cases.opened_on) as depart')
            ->lazyById(500, 'recovery_cases.id', 'id')
            ->map(fn (RecoveryCase $dossier): ReminderHit => new ReminderHit(
                $dossier->id,
                CarbonImmutable::parse($dossier->getAttribute('depart'))->startOfDay(),
                organizationId: $dossier->organization_id,
            ));
    }
}
