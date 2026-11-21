<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\RecordSupplierPayment;
use App\Modules\Maintenance\Http\Requests\SupplierPaymentRequest;
use App\Modules\Maintenance\Http\Resources\PaymentResource;
use Illuminate\Http\JsonResponse;

final class StoreSupplierPaymentController
{
    public function __invoke(string $intervention, string $invoice, SupplierPaymentRequest $request, RecordSupplierPayment $action): JsonResponse
    {
        $resultat = $action->handle($intervention, $invoice, $request->toData());

        return (new PaymentResource($resultat['payment'], $resultat['replayed']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
