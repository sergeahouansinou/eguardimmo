<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\ReplaceBankAccount;
use App\Modules\Banking\Http\Requests\ReplaceAccountRequest;
use App\Modules\Banking\Http\Resources\BankAccountResource;
use App\Modules\Banking\Support\Actor;
use App\Modules\Banking\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;

final class ReplaceAccountController
{
    public function __invoke(ReplaceAccountRequest $request, string $account, ReplaceBankAccount $remplacement): JsonResponse
    {
        $resultat = $remplacement->handle($account, $request->toData(), Actor::id($request), IdempotencyHeader::read($request));

        return (new BankAccountResource($resultat['account']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
