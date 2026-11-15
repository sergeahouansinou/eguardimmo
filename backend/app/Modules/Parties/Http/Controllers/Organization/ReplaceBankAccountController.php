<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Actions\ReplaceBankAccount;
use App\Modules\Parties\Http\Requests\SaveBankAccountRequest;
use App\Modules\Parties\Http\Resources\BankAccountResource;
use App\Modules\Parties\Queries\Parties;
use App\Modules\Parties\Queries\PartyParts;
use Illuminate\Http\JsonResponse;

final class ReplaceBankAccountController
{
    public function __invoke(string $party, string $bankAccount, SaveBankAccountRequest $request, Parties $parties, PartyParts $parts, ReplaceBankAccount $remplacer): JsonResponse
    {
        $ancien = $parts->bankAccount($parties->get($party)->id, $bankAccount);

        return (new BankAccountResource($remplacer->handle($ancien, $request->toData())))->response()->setStatusCode(201);
    }
}
