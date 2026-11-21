<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Actions\IssueCreditNote;
use App\Modules\Invoicing\Http\Requests\CreditNoteRequest;
use App\Modules\Invoicing\Http\Resources\InvoiceResource;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class StoreCreditNoteController
{
    public function __invoke(string $invoice, CreditNoteRequest $request, IssueCreditNote $avoir): JsonResponse
    {
        $resultat = $avoir->handle($invoice, $request->toData(), CarbonImmutable::today());

        return (new InvoiceResource($resultat['invoice']->load(['lines', 'taxes']), null, $resultat['replayed']))
            ->response()
            ->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
