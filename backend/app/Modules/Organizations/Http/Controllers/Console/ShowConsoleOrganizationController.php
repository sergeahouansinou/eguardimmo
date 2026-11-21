<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Console;

use App\Modules\Organizations\Http\Resources\Console\ConsoleOrganizationResource;
use App\Modules\Organizations\Queries\ConsoleOrganizations;
use App\Modules\Subscriptions\PublicApi\SubscriptionDirectory;
use App\Shared\Audit\RecordAudit;

final class ShowConsoleOrganizationController
{
    public function __invoke(string $organization, ConsoleOrganizations $organisations, SubscriptionDirectory $abonnements, RecordAudit $audit): ConsoleOrganizationResource
    {
        $organisation = $organisations->find($organization);

        $resume = $abonnements->summaries([$organisation->id])[$organisation->id] ?? null;

        $audit->handle('console.organization.viewed', metadata: [], subject: $organisation);

        return new ConsoleOrganizationResource($organisations->data(
            $organisation,
            $organisations->activeMemberCounts([$organisation->id])[$organisation->id] ?? 0,
            $resume?->planCode,
            $resume?->status,
            $organisations->owner($organisation->id),
            true,
        ));
    }
}
