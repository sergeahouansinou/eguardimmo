<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\RequestTrustDeposit;
use App\Modules\OwnerFunds\Http\Requests\TrustDepositRequest;
use App\Modules\OwnerFunds\Http\Resources\TrustDepositResource;
use App\Modules\OwnerFunds\Support\Actor;
use App\Modules\OwnerFunds\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class StoreTrustDepositController
{
    public function __invoke(TrustDepositRequest $request, RequestTrustDeposit $apport): JsonResponse
    {
        $resultat = $apport->handle(
            (int) $request->validated('amount'), (string) $request->validated('executed_on'), trim((string) $request->validated('reference')),
            IdempotencyHeader::read($request), Actor::id($request), CarbonImmutable::today(),
        );

        return (new TrustDepositResource($resultat['deposit']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
