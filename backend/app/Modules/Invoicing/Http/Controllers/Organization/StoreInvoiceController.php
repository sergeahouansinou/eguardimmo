<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Controllers\Organization;

use App\Modules\Invoicing\Actions\CreateDraft;
use App\Modules\Invoicing\Http\Requests\DraftRequest;
use App\Modules\Invoicing\Http\Resources\InvoiceResource;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class StoreInvoiceController
{
    public function __invoke(DraftRequest $request, CreateDraft $creer): JsonResponse
    {
        $resultat = $creer->handle($request->toData(), CarbonImmutable::today());

        return (new InvoiceResource($resultat['invoice']->load(['lines', 'taxes']), null, $resultat['replayed']))
            ->response()
            ->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
