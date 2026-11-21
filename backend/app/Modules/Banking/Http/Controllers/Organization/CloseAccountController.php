<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\CloseBankAccount;
use App\Modules\Banking\Http\Resources\BankAccountResource;
use App\Modules\Banking\Support\Actor;
use Illuminate\Http\Request;

final class CloseAccountController
{
    public function __invoke(Request $request, string $account, CloseBankAccount $fermeture): BankAccountResource
    {
        return new BankAccountResource($fermeture->handle($account, Actor::id($request)));
    }
}
