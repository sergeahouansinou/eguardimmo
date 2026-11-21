<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\AllocateInvoice;
use App\Modules\Maintenance\Http\Requests\AllocationRequest;
use App\Modules\Maintenance\Http\Resources\AllocationResource;
use Illuminate\Http\JsonResponse;

final class StoreAllocationController
{
    public function __invoke(string $intervention, string $invoice, AllocationRequest $request, AllocateInvoice $action): JsonResponse
    {
        $resultat = $action->handle($intervention, $invoice, $request->toData());

        return (new AllocationResource($resultat['allocation'], $resultat['replayed']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
