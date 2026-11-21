<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Http\Resources\ManagementReportResource;
use App\Modules\Reporting\Support\Reports;

final class ShowReportController
{
    public function __invoke(string $report, Reports $rapports): ManagementReportResource
    {
        return new ManagementReportResource($rapports->find($report)->load('lines'));
    }
}
