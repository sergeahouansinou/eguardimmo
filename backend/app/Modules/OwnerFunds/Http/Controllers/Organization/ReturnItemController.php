<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\ReturnPayoutItem;
use App\Modules\OwnerFunds\Http\Requests\ReasonRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutItemResource;
use App\Modules\OwnerFunds\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class ReturnItemController
{
    public function __invoke(ReasonRequest $request, string $batch, string $item, ReturnPayoutItem $retour): JsonResponse
    {
        $resultat = $retour->handle($batch, $item, $request->reason(), IdempotencyHeader::read($request), CarbonImmutable::today());

        return (new PayoutItemResource($resultat['item']))->response();
    }
}
