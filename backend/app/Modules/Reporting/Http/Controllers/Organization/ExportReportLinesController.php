<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Support\Csv;
use App\Modules\Reporting\Support\Reports;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Response;

final class ExportReportLinesController
{
    public function __invoke(string $report, Reports $rapports, RecordAudit $audit): Response
    {
        $rapport = $rapports->find($report);
        if ($rapport->lines()->count() > (int) config('reporting.export_max_rows')) {
            throw ErrorCode::ExportTooLarge->problem();
        }

        $lignes = [['date', 'type', 'libelle', 'sens', 'montant_minor', 'devise']];

        foreach ($rapport->lines()->get() as $l) {
            $lignes[] = [$l->entry_date->toDateString(), $l->kind->value, $l->label, $l->direction->value, $l->amount, $rapport->currency];
        }

        $audit->handle('reporting.export.generated', subject: $rapport, metadata: ['rows' => count($lignes) - 1, 'number' => $rapport->number]);

        return response(Csv::render($lignes), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="lignes-'.($rapport->number ?? $rapport->id).'.csv"',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
