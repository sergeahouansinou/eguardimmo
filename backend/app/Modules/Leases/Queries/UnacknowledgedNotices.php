<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\NoticeRequestStatus;
use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

final readonly class UnacknowledgedNotices
{
    /**
     * Organisations qui ont une demande déposée avant `$avant`, sans accusé et pas encore signalée : sert à la tâche planifiée.
     *
     * @return list<string>
     */
    public function organizations(CarbonImmutable $avant): array
    {
        return array_values(AcrossOrganizations::query(LeaseNoticeRequest::class)
            ->where('status', NoticeRequestStatus::Submitted->value)
            ->whereNull('late_flagged_at')
            ->where('created_at', '<=', $avant)
            ->distinct()
            ->orderBy('organization_id')
            ->pluck('organization_id')
            ->map(fn (mixed $id): string => (string) $id)
            ->all());
    }
}
