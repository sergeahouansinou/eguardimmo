<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Http\Resources\Owner\OwnerReportResource;
use App\Modules\Reporting\Queries\OwnerReports;
use Illuminate\Http\Request;

final class ShowOwnerReportController
{
    public function __invoke(string $report, Request $request, MandateDirectory $mandats, OwnerReports $rapports, OrganizationDirectory $organisations): OwnerReportResource
    {
        /** @var User $user */
        $user = $request->user();
        $rapport = $rapports->find($mandats->ownerScope($user->id), $report, true) ?? throw ErrorCode::OwnerReportNotFound->problem();

        return new OwnerReportResource(['report' => $rapport, 'agency_name' => $organisations->names([$rapport->organization_id])[$rapport->organization_id] ?? null, 'detail' => true]);
    }
}
