<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

final readonly class DueApprovals
{
    /**
     * @return list<string>
     */
    public function organizations(CarbonImmutable $maintenant): array
    {
        return array_values(array_map(strval(...), AcrossOrganizations::query(InterventionApproval::class)
            ->whereIn('status', [ApprovalStatus::Pending->value, ApprovalStatus::Question->value])
            ->where('decide_before', '<', $maintenant->format('Y-m-d H:i:s.u'))
            ->distinct()->orderBy('organization_id')->pluck('organization_id')->all()));
    }

    /**
     * Sous le contexte d'une organisation.
     *
     * @return list<string>
     */
    public function ids(CarbonImmutable $maintenant): array
    {
        return array_values(array_map(strval(...), InterventionApproval::query()
            ->whereIn('status', [ApprovalStatus::Pending->value, ApprovalStatus::Question->value])
            ->where('decide_before', '<', $maintenant->format('Y-m-d H:i:s.u'))
            ->orderBy('id')->limit(200)->pluck('id')->all()));
    }
}
