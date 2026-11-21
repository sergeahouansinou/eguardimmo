<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Models\SupplierInvoice;
use Illuminate\Support\Str;

final readonly class Invoices
{
    public function get(string $interventionId, string $invoiceId): SupplierInvoice
    {
        $facture = Str::isUuid($invoiceId)
            ? SupplierInvoice::query()->with(['taxes', 'allocations', 'payments'])->whereKey($invoiceId)->where('intervention_id', $interventionId)->first()
            : null;

        return $facture ?? throw ErrorCode::InvoiceNotFound->problem();
    }
}
