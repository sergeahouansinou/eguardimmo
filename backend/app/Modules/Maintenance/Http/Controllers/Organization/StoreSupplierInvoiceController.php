<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\RecordSupplierInvoice;
use App\Modules\Maintenance\Http\Requests\SupplierInvoiceRequest;
use App\Modules\Maintenance\Http\Resources\SupplierInvoiceResource;
use App\Modules\Maintenance\Queries\Invoices;
use Illuminate\Http\JsonResponse;

final class StoreSupplierInvoiceController
{
    public function __invoke(string $intervention, SupplierInvoiceRequest $request, RecordSupplierInvoice $action, Invoices $factures): JsonResponse
    {
        $resultat = $action->handle($intervention, $request->toData());
        $facture = $factures->get($intervention, $resultat['invoice']->id);

        return (new SupplierInvoiceResource($facture, $resultat['replayed']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
