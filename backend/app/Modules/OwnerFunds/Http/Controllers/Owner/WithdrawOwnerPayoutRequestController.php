<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\OwnerFunds\Actions\WithdrawPayoutAccountRequest;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Http\Resources\OwnerPayoutRequestResource;
use App\Modules\OwnerFunds\Queries\PayoutAccountRequests;
use App\Modules\OwnerFunds\Support\OwnerPayoutGate;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Request;

final class WithdrawOwnerPayoutRequestController
{
    public function __invoke(
        string $payoutRequest,
        Request $request,
        MandateDirectory $mandats,
        PayoutAccountRequests $demandes,
        OwnerPayoutGate $porte,
        CurrentOrganization $contexte,
        WithdrawPayoutAccountRequest $action,
        PartyBankAccounts $comptes,
    ): OwnerPayoutRequestResource {
        /** @var User $user */
        $user = $request->user();
        $portee = $mandats->ownerScope($user->id);
        $cible = $demandes->ofOwner($portee, $payoutRequest) ?? throw ErrorCode::RequestNotFound->problem();
        $visible = $portee->visible($cible->organization_id, $cible->mandant_party_id) ?? throw ErrorCode::RequestNotFound->problem();

        return $contexte->run($cible->organization_id, function () use ($porte, $visible, $action, $cible, $user, $comptes): OwnerPayoutRequestResource {
            $porte->assertWritable($visible);
            $retiree = $action->handle($cible->id, $user->id);

            return new OwnerPayoutRequestResource(['request' => $retiree, 'account' => $comptes->state($retiree->bank_account_id)]);
        });
    }
}
