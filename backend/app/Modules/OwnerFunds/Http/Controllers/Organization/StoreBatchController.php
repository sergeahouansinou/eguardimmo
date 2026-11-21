<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\CreatePayoutBatch;
use App\Modules\OwnerFunds\Http\Requests\CreateBatchRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutBatchResource;
use App\Modules\OwnerFunds\Support\Actor;
use App\Modules\OwnerFunds\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class StoreBatchController
{
    public function __invoke(CreateBatchRequest $request, CreatePayoutBatch $creation): JsonResponse
    {
        $cle = IdempotencyHeader::read($request);
        $resultat = $creation->handle($request->mandantIds(), $cle, Actor::id($request), CarbonImmutable::today());

        return (new PayoutBatchResource($resultat['batch']->load('items')))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
