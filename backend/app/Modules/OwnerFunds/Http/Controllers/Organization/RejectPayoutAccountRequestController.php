<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\RejectPayoutAccountRequest;
use App\Modules\OwnerFunds\Http\Requests\RejectPayoutAccountRequestRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutAccountRequestResource;
use App\Modules\OwnerFunds\Support\Actor;
use App\Modules\Parties\PublicApi\PartyBankAccounts;

final class RejectPayoutAccountRequestController
{
    public function __invoke(string $payoutRequest, RejectPayoutAccountRequestRequest $corps, RejectPayoutAccountRequest $action, PartyBankAccounts $comptes): PayoutAccountRequestResource
    {
        $v = $corps->validated();
        $demande = $action->handle($payoutRequest, (int) $v['lock_version'], trim((string) $v['reason']), Actor::id($corps));

        return new PayoutAccountRequestResource(['request' => $demande, 'account' => $comptes->state($demande->bank_account_id)]);
    }
}
