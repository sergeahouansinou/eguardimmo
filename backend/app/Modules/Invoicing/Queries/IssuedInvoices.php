<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Queries;

use App\Modules\Invoicing\Data\InvoiceDocumentData;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Models\Invoice;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Str;

final readonly class IssuedInvoices
{
    public function __construct(private CurrentOrganization $organisation) {}

    public function find(string $invoiceId): InvoiceDocumentData
    {
        $this->organisation->id();

        $facture = Str::isUuid($invoiceId)
            ? Invoice::query()->where('kind', InvoiceKind::Invoice->value)->whereNotNull('number')->whereNotNull('issued_document_id')->find($invoiceId)
            : null;

        if ($facture === null || $facture->issued_document_id === null || $facture->stored_file_id === null) {
            throw ErrorCode::InvoiceNotFound->problem();
        }

        return new InvoiceDocumentData(
            $facture->id,
            (string) $facture->number,
            $facture->lease_id,
            (string) $facture->issued_on?->toDateString(),
            (string) $facture->due_on?->toDateString(),
            $facture->issued_document_id,
            $facture->stored_file_id,
            (string) $facture->fingerprint,
        );
    }
}
