<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Http\Resources\InvoiceResource;
use App\Modules\Invoicing\Queries\Invoices;

final class ShowInvoiceController
{
    public function __invoke(string $invoice, Invoices $factures): InvoiceResource
    {
        $facture = $factures->get($invoice);

        return new InvoiceResource($facture, $factures->outstanding([$facture])[$facture->id] ?? null);
    }
}
