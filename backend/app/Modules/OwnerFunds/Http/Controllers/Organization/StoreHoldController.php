<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\PlaceHold;
use App\Modules\OwnerFunds\Enums\HoldKind;
use App\Modules\OwnerFunds\Enums\HoldReason;
use App\Modules\OwnerFunds\Http\Requests\PlaceHoldRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutHoldResource;
use App\Modules\OwnerFunds\Support\Actor;
use Illuminate\Http\JsonResponse;

final class StoreHoldController
{
    public function __invoke(PlaceHoldRequest $request, PlaceHold $pose): JsonResponse
    {
        $v = $request->validated();
        $retenue = $pose->handle(
            (string) $v['mandant_party_id'], HoldKind::from((string) $v['kind']), isset($v['amount']) ? (int) $v['amount'] : null,
            HoldReason::from((string) $v['reason']), isset($v['comment']) ? trim((string) $v['comment']) : null, Actor::id($request),
        );

        return (new PayoutHoldResource($retenue))->response()->setStatusCode(201);
    }
}
