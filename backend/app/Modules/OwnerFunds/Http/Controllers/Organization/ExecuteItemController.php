<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\ExecutePayoutItem;
use App\Modules\OwnerFunds\Http\Requests\ExecuteItemRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutItemResource;
use App\Modules\OwnerFunds\Support\Actor;
use App\Modules\OwnerFunds\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ExecuteItemController
{
    public function __invoke(ExecuteItemRequest $request, string $batch, string $item, ExecutePayoutItem $execution): JsonResponse
    {
        $reference = $request->filled('reference') ? trim((string) $request->validated('reference')) : null;
        $resultat = $execution->handle($batch, $item, (string) $request->validated('executed_on'), $reference, IdempotencyHeader::read($request), Actor::id($request), CarbonImmutable::today(), $request->boolean('acknowledge_account_change'));

        return (new PayoutItemResource($resultat['item']))->response();
    }
}
