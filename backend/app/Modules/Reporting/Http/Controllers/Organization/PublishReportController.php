<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Actions\PublishReport;
use App\Modules\Reporting\Actions\SchedulePublication;
use App\Modules\Reporting\Http\Requests\PublishReportRequest;
use App\Modules\Reporting\Http\Resources\ManagementReportResource;
use App\Modules\Reporting\Support\Reports;
use Carbon\CarbonImmutable;

final class PublishReportController
{
    public function __invoke(string $report, PublishReportRequest $request, Reports $rapports, PublishReport $publication, SchedulePublication $planification): ManagementReportResource
    {
        $rapport = $rapports->find($report);

        if ($request->has('scheduled_for')) {
            return new ManagementReportResource($planification->handle($rapport, $request->scheduledFor())->load('lines'));
        }

        $utilisateur = $request->user();
        $publie = $publication->handle($rapport, $utilisateur === null ? null : (string) $utilisateur->getKey(), CarbonImmutable::today());

        return new ManagementReportResource($publie->load('lines'));
    }
}
