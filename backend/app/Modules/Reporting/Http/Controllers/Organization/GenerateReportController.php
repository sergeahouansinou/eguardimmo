<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Actions\GenerateReport;
use App\Modules\Reporting\Http\Resources\ManagementReportResource;
use App\Modules\Reporting\Support\Reports;

final class GenerateReportController
{
    public function __invoke(string $report, Reports $rapports, GenerateReport $generation): ManagementReportResource
    {
        return new ManagementReportResource($generation->handle($rapports->find($report))->load('lines'));
    }
}
