<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\OwnerFunds\Actions\CreatePayoutAccountRequest;
use App\Modules\OwnerFunds\Http\Requests\RequestPayoutAccountChangeRequest;
use App\Modules\OwnerFunds\Http\Resources\OwnerPayoutRequestResource;
use App\Modules\OwnerFunds\Support\OwnerPayoutGate;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\JsonResponse;

final class StoreOwnerPayoutRequestController
{
    public function __invoke(RequestPayoutAccountChangeRequest $request, OwnerPayoutGate $porte, CurrentOrganization $contexte, CreatePayoutAccountRequest $action, PartyBankAccounts $comptes): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $visible = $porte->visible($user->id, (string) $request->validated('access_id'));

        [$demande, $etat] = $contexte->run($visible->organizationId, function () use ($porte, $visible, $request, $action, $user, $comptes): array {
            $porte->assertWritable($visible);
            $creee = $action->handle($request->toData($visible->mandantPartyId), $user);

            return [$creee, $comptes->state($creee->bank_account_id)];
        });

        return (new OwnerPayoutRequestResource(['request' => $demande, 'account' => $etat]))->response()->setStatusCode(201);
    }
}
