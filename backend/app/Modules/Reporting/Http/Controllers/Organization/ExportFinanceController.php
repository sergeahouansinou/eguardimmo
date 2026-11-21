<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Http\Requests\ExportFinanceRequest;
use App\Modules\Reporting\Queries\Finance\FinanceExports;
use App\Modules\Reporting\Support\Csv;
use App\Modules\Reporting\Support\Finance\ProfitabilityYear;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Http\Response;

final class ExportFinanceController
{
    public function __invoke(string $type, ExportFinanceRequest $request, FinanceExports $exports, RecordAudit $audit): Response
    {
        $lignes = $type === 'prets-immobiliers'
            ? $exports->loans($request->from(), $request->to())
            : $exports->profitability(ProfitabilityYear::assert($request->year(), CarbonImmutable::today()), CarbonImmutable::today());

        if (count($lignes) - 1 > (int) config('reporting.export_max_rows')) {
            throw ErrorCode::ExportTooLarge->problem();
        }

        $audit->handle('reporting.export.generated', metadata: ['type' => $type, 'rows' => count($lignes) - 1]);

        return response(Csv::render($lignes), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$type.'.csv"',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
