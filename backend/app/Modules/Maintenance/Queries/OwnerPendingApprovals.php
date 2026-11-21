<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Query\Builder;

/**
 * Devis qui attendent la décision du mandant : interventions en attente d'accord dont la demande est ouverte (`pending`). Une question
 * posée à l'agence (`question`) attend l'agence, pas le mandant. Le co-indivisaire ne décide jamais : il n'en compte aucun.
 */
final readonly class OwnerPendingApprovals
{
    private const array ROLES_DECIDEURS = ['holder', 'representative'];

    public function count(OwnerScopeData $portee): int
    {
        return $portee->restrictToMandants(AcrossOrganizations::query(Intervention::class), 'organization_id', 'mandant_party_id', self::ROLES_DECIDEURS)
            ->where('status', InterventionStatus::AwaitingApproval->value)
            ->whereExists(fn (Builder $q) => $q->from('intervention_approvals as a')
                ->whereColumn('a.intervention_id', 'interventions.id')
                ->whereColumn('a.organization_id', 'interventions.organization_id')
                ->where('a.status', ApprovalStatus::Pending->value))
            ->count();
    }
}
