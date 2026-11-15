<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\AddBankAccount;
use App\Modules\Parties\Http\Requests\SaveBankAccountRequest;
use App\Modules\Parties\Http\Resources\BankAccountResource;
use App\Modules\Parties\Queries\Parties;
use Illuminate\Http\JsonResponse;

final class AddBankAccountController
{
    public function __invoke(string $party, SaveBankAccountRequest $request, Parties $parties, AddBankAccount $ajouter): JsonResponse
    {
        return (new BankAccountResource($ajouter->handle($parties->get($party), $request->toData())))->response()->setStatusCode(201);
    }
}
