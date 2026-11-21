<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Owner;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Queries\OwnerInvoices;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadOwnerInvoiceController
{
    public function __invoke(string $invoice, Request $request, MandateDirectory $mandats, OwnerInvoices $factures, DocumentStore $fichiers, CurrentOrganization $contexte, RecordAudit $audit): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $facture = $factures->find($mandats->ownerScope($user->id), $invoice) ?? throw ErrorCode::OwnerInvoiceNotFound->problem();

        if ($facture->stored_file_id === null) {
            throw ErrorCode::PdfUnavailable->problem();
        }

        return $contexte->run($facture->organization_id, function () use ($facture, $fichiers, $audit): StreamedResponse {
            return DB::transaction(function () use ($facture, $fichiers, $audit): StreamedResponse {
                $reponse = $fichiers->stream($facture->stored_file_id);
                $audit->handle('invoicing.invoice.downloaded', subject: $facture, metadata: ['number' => $facture->number, 'space' => 'owner']);

                return $reponse;
            });
        });
    }
}
