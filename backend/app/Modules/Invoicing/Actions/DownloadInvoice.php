<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Actions;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Models\Invoice;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final readonly class DownloadInvoice
{
    public function __construct(
        private DocumentStore $documents,
        private RecordAudit $audit,
    ) {}

    /**
     * Le PDF figé à l'émission : jamais régénéré. Un brouillon n'a pas de PDF.
     */
    public function handle(string $invoiceId): StreamedResponse
    {
        $facture = (Str::isUuid($invoiceId) ? Invoice::query()->find($invoiceId) : null) ?? throw ErrorCode::InvoiceNotFound->problem();

        if ($facture->stored_file_id === null) {
            throw ErrorCode::NotIssued->problem();
        }

        DB::transaction(fn () => $this->audit->handle('invoicing.invoice.downloaded', subject: $facture, metadata: ['number' => $facture->number]));

        return $this->documents->stream($facture->stored_file_id);
    }
}
