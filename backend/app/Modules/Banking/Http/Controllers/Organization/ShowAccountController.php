<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Http\Resources\BankAccountResource;
use App\Modules\Banking\Queries\BankAccounts;

final class ShowAccountController
{
    public function __invoke(string $account, BankAccounts $comptes): BankAccountResource
    {
        return new BankAccountResource($comptes->query()->find($account) ?? throw ErrorCode::AccountNotFound->problem());
    }
}
