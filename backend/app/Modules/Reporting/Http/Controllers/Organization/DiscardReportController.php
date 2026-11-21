<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Actions\DiscardReport;
use App\Modules\Reporting\Http\Resources\ManagementReportResource;
use App\Modules\Reporting\Support\Reports;

final class DiscardReportController
{
    public function __invoke(string $report, Reports $rapports, DiscardReport $abandon): ManagementReportResource
    {
        return new ManagementReportResource($abandon->handle($rapports->find($report)));
    }
}
