<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Models\TaxSummary;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final readonly class SummaryDownloads
{
    public function __construct(private DocumentStore $fichiers, private RecordAudit $audit) {}

    public function pdf(TaxSummary $synthese): StreamedResponse
    {
        if ($synthese->stored_file_id === null) {
            throw ErrorCode::PdfUnavailable->problem();
        }

        return DB::transaction(function () use ($synthese): StreamedResponse {
            $reponse = $this->fichiers->stream($synthese->stored_file_id);
            $this->audit->handle('tax.summary.downloaded', subject: $synthese, metadata: ['income_year' => $synthese->income_year, 'scope' => $synthese->scope->value]);

            return $reponse;
        });
    }

    public function csv(TaxSummary $synthese): Response
    {
        if ($synthese->lines()->count() > (int) config('tax.export_max_rows')) {
            throw ErrorCode::ExportTooLarge->problem();
        }

        $lignes = [['bien', 'ligne', 'etat', 'montant_exact_minor', 'montant_arrondi_minor', 'devise']];

        foreach ($synthese->lines()->orderBy('position')->get() as $l) {
            $lignes[] = [$l->property_id ?? 'total', $l->line_code, $l->status, $l->amount_exact, $l->amount_rounded, $synthese->currency];
        }

        $this->audit->handle('tax.summary.exported', subject: $synthese, metadata: ['income_year' => $synthese->income_year, 'rows' => count($lignes) - 1, 'scope' => $synthese->scope->value]);

        return response(Csv::render($lignes), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="synthese-'.$synthese->income_year.'-lignes.csv"',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
