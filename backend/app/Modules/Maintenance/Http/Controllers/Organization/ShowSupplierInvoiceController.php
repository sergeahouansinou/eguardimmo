<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Http\Resources\SupplierInvoiceResource;
use App\Modules\Maintenance\Queries\Invoices;

final class ShowSupplierInvoiceController
{
    public function __invoke(string $intervention, string $invoice, Invoices $factures): SupplierInvoiceResource
    {
        return new SupplierInvoiceResource($factures->get($intervention, $invoice));
    }
}
