<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Owner;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Queries\OwnerReports;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadOwnerReportPdfController
{
    public function __invoke(string $report, Request $request, MandateDirectory $mandats, OwnerReports $rapports, DocumentStore $fichiers, CurrentOrganization $contexte, RecordAudit $audit): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $rapport = $rapports->find($mandats->ownerScope($user->id), $report) ?? throw ErrorCode::OwnerReportNotFound->problem();

        if ($rapport->stored_file_id === null) {
            throw ErrorCode::PdfUnavailable->problem();
        }

        return $contexte->run($rapport->organization_id, function () use ($rapport, $fichiers, $audit): StreamedResponse {
            return DB::transaction(function () use ($rapport, $fichiers, $audit): StreamedResponse {
                $reponse = $fichiers->stream((string) $rapport->stored_file_id);
                $audit->handle('reporting.report.downloaded', subject: $rapport, metadata: ['number' => $rapport->number, 'preview' => false]);

                return $reponse;
            });
        });
    }
}
