<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Actions\RectifyReport;
use App\Modules\Reporting\Http\Requests\RectifyReportRequest;
use App\Modules\Reporting\Http\Resources\ManagementReportResource;
use App\Modules\Reporting\Support\Reports;
use Illuminate\Http\JsonResponse;

final class RectifyReportController
{
    public function __invoke(string $report, RectifyReportRequest $request, Reports $rapports, RectifyReport $rectification): JsonResponse
    {
        $utilisateur = $request->user();
        $nouveau = $rectification->handle($rapports->find($report), $request->reason(), $utilisateur === null ? null : (string) $utilisateur->getKey());

        return (new ManagementReportResource($nouveau->load('lines')))->response()->setStatusCode(201);
    }
}
