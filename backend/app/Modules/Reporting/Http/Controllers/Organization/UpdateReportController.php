<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Actions\UpdateReport;
use App\Modules\Reporting\Http\Requests\UpdateReportRequest;
use App\Modules\Reporting\Http\Resources\ManagementReportResource;
use App\Modules\Reporting\Support\Reports;

final class UpdateReportController
{
    public function __invoke(string $report, UpdateReportRequest $request, Reports $rapports, UpdateReport $mise): ManagementReportResource
    {
        return new ManagementReportResource($mise->handle($rapports->find($report), $request->lockVersion(), $request->changes())->load('lines'));
    }
}
