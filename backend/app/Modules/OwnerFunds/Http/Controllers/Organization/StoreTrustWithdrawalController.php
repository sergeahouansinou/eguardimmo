<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\TransferTrustFunds;
use App\Modules\OwnerFunds\Http\Requests\TrustTransferRequest;
use App\Modules\OwnerFunds\Http\Resources\TrustTransferResource;
use App\Modules\OwnerFunds\Support\Actor;
use App\Modules\OwnerFunds\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class StoreTrustWithdrawalController
{
    public function __invoke(TrustTransferRequest $request, TransferTrustFunds $virement): JsonResponse
    {
        $reference = $request->filled('reference') ? trim((string) $request->validated('reference')) : null;
        $resultat = $virement->handle(
            (int) $request->validated('amount'), (string) $request->validated('executed_on'), $reference,
            IdempotencyHeader::read($request), Actor::id($request), CarbonImmutable::today(),
        );

        return (new TrustTransferResource($resultat['transfer']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
