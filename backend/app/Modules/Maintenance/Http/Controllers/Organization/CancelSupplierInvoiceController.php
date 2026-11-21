<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\CancelSupplierInvoice;
use App\Modules\Maintenance\Http\Resources\SupplierInvoiceResource;
use App\Modules\Maintenance\Queries\Invoices;

final class CancelSupplierInvoiceController
{
    public function __invoke(string $intervention, string $invoice, CancelSupplierInvoice $action, Invoices $factures): SupplierInvoiceResource
    {
        $action->handle($intervention, $invoice);

        return new SupplierInvoiceResource($factures->get($intervention, $invoice));
    }
}
