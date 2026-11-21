<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Actions\RecordInvoicePayment;
use App\Modules\Invoicing\Http\Requests\InvoicePaymentRequest;
use App\Modules\Invoicing\Http\Resources\InvoicePaymentResource;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class RecordInvoicePaymentController
{
    public function __invoke(string $invoice, InvoicePaymentRequest $request, RecordInvoicePayment $regler): JsonResponse
    {
        $resultat = $regler->handle($invoice, $request->toData(), CarbonImmutable::today());

        return (new InvoicePaymentResource($resultat['payment'], $resultat['replayed']))
            ->response()
            ->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
