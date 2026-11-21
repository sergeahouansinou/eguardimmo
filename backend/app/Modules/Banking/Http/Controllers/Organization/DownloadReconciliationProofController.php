<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Models\BankReconciliation;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Shared\Audit\RecordAudit;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadReconciliationProofController
{
    public function __invoke(string $reconciliation, DocumentStore $documents, RecordAudit $audit): StreamedResponse
    {
        $etat = BankReconciliation::query()->find($reconciliation) ?? throw ErrorCode::ReconciliationNotFound->problem();

        if ($etat->balance_proof_file_id === null) {
            throw ErrorCode::ReconciliationNotFound->problem();
        }

        $audit->handle('banking.reconciliation.proof_downloaded', subject: $etat);

        return $documents->stream($etat->balance_proof_file_id);
    }
}
