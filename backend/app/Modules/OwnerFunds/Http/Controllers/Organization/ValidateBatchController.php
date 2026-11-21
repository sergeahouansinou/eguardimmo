<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\ValidatePayoutBatch;
use App\Modules\OwnerFunds\Http\Requests\BatchVersionRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutBatchResource;
use App\Modules\OwnerFunds\Support\Actor;
use App\Modules\OwnerFunds\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ValidateBatchController
{
    public function __invoke(BatchVersionRequest $request, string $batch, ValidatePayoutBatch $validation): JsonResponse
    {
        $resultat = $validation->handle($batch, $request->lockVersion(), IdempotencyHeader::read($request), Actor::id($request), CarbonImmutable::today());

        return (new PayoutBatchResource($resultat['batch']->load('items')))->response();
    }
}
