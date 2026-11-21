<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Actions\SchedulePublication;
use App\Modules\Reporting\Http\Resources\ManagementReportResource;
use App\Modules\Reporting\Support\Reports;

final class UnscheduleReportController
{
    public function __invoke(string $report, Reports $rapports, SchedulePublication $planification): ManagementReportResource
    {
        return new ManagementReportResource($planification->handle($rapports->find($report), null)->load('lines'));
    }
}
