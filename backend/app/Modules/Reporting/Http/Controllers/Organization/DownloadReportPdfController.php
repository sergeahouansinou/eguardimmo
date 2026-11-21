<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Support\PdfRenderer;
use App\Modules\Reporting\Support\ReportHtml;
use App\Modules\Reporting\Support\Reports;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadReportPdfController
{
    public function __invoke(string $report, Reports $rapports, DocumentStore $fichiers, ReportHtml $html, PdfRenderer $pdf, RecordAudit $audit): Response|StreamedResponse
    {
        $rapport = $rapports->find($report);

        if (in_array($rapport->status, [ReportStatus::Published, ReportStatus::Superseded], true) && $rapport->stored_file_id !== null) {
            $audit->handle('reporting.report.downloaded', subject: $rapport, metadata: ['number' => $rapport->number, 'preview' => false]);

            return $fichiers->stream($rapport->stored_file_id);
        }

        if ($rapport->status !== ReportStatus::Generated) {
            throw $rapport->status === ReportStatus::Draft ? ErrorCode::NotGenerated->problem() : ErrorCode::NotPublishable->problem();
        }

        $contenu = $pdf->render($html->render($rapport->snapshot ?? [], true));
        $audit->handle('reporting.report.downloaded', subject: $rapport, metadata: ['number' => null, 'preview' => true]);

        return response($contenu, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="projet-compte-rendu.pdf"',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
