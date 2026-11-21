<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\CancelPayoutBatch;
use App\Modules\OwnerFunds\Http\Requests\CancelBatchRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutBatchResource;
use App\Modules\OwnerFunds\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class CancelBatchController
{
    public function __invoke(CancelBatchRequest $request, string $batch, CancelPayoutBatch $annulation): JsonResponse
    {
        $resultat = $annulation->handle($batch, $request->reason(), $request->lockVersion(), IdempotencyHeader::read($request), CarbonImmutable::today());

        return (new PayoutBatchResource($resultat['batch']->load('items')))->response();
    }
}
