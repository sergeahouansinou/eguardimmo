<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\ApprovePayoutAccountRequest;
use App\Modules\OwnerFunds\Http\Requests\ApprovePayoutAccountRequestRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutAccountRequestResource;
use App\Modules\OwnerFunds\Support\Actor;
use App\Modules\Parties\PublicApi\PartyBankAccounts;

final class ApprovePayoutAccountRequestController
{
    public function __invoke(string $payoutRequest, ApprovePayoutAccountRequestRequest $corps, ApprovePayoutAccountRequest $action, PartyBankAccounts $comptes): PayoutAccountRequestResource
    {
        $v = $corps->validated();
        $demande = $action->handle($payoutRequest, (int) $v['lock_version'], (string) $v['iban'], (string) $v['holder_name'], Actor::id($corps));

        return new PayoutAccountRequestResource(['request' => $demande, 'account' => $comptes->state($demande->bank_account_id)]);
    }
}
