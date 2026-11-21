<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Actions\UpdateBankAccount;
use App\Modules\Banking\Http\Requests\UpdateAccountRequest;
use App\Modules\Banking\Http\Resources\BankAccountResource;

final class UpdateAccountController
{
    public function __invoke(UpdateAccountRequest $request, string $account, UpdateBankAccount $modification): BankAccountResource
    {
        $profil = $request->validated('csv_profile');

        return new BankAccountResource($modification->handle($account, trim((string) $request->validated('label')), is_array($profil) ? $profil : null));
    }
}
