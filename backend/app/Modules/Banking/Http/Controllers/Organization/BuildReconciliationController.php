<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\BuildReconciliation;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Http\Requests\BuildReconciliationRequest;
use App\Modules\Banking\Http\Resources\BankReconciliationResource;
use App\Modules\Banking\Support\Actor;
use App\Modules\Banking\Support\IdempotencyHeader;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class BuildReconciliationController
{
    public function __invoke(BuildReconciliationRequest $request, BuildReconciliation $etat): JsonResponse
    {
        $v = $request->validated();
        $resultat = $etat->handle(
            (string) $v['bank_account_id'], CarbonImmutable::createFromFormat('!Y-m', (string) $v['month']) ?: throw ErrorCode::ReconciliationNotActionable->problem(),
            isset($v['bank_balance']) ? (int) $v['bank_balance'] : null, $request->file('proof')?->getRealPath() ?: null, Actor::id($request), IdempotencyHeader::read($request),
        );

        return (new BankReconciliationResource($resultat['reconciliation']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
