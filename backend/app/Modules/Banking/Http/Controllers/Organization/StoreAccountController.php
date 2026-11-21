<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\CreateBankAccount;
use App\Modules\Banking\Http\Requests\BankAccountRequest;
use App\Modules\Banking\Http\Resources\BankAccountResource;
use App\Modules\Banking\Support\Actor;
use App\Modules\Banking\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;

final class StoreAccountController
{
    public function __invoke(BankAccountRequest $request, CreateBankAccount $creation): JsonResponse
    {
        $resultat = $creation->handle($request->toData(), Actor::id($request), IdempotencyHeader::read($request));

        return (new BankAccountResource($resultat['account']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
