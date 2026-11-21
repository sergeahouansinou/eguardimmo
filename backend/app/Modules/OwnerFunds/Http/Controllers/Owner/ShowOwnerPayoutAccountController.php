<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Owner;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\HoldReason;
use App\Modules\OwnerFunds\Http\Resources\OwnerPayoutAccountResource;
use App\Modules\OwnerFunds\Http\Resources\OwnerPayoutRequestResource;
use App\Modules\OwnerFunds\Models\PayoutHold;
use App\Modules\OwnerFunds\Queries\PayoutAccountRequests;
use App\Modules\OwnerFunds\Support\OwnerPayoutGate;
use App\Modules\Parties\PublicApi\PartyBankAccounts;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ShowOwnerPayoutAccountController
{
    public function __invoke(
        Request $request,
        MandateDirectory $mandats,
        PayoutAccountRequests $demandes,
        OwnerPayoutGate $porte,
        PartyDirectory $parties,
        PartyBankAccounts $comptes,
        OrganizationDirectory $organisations,
        CurrentOrganization $contexte,
    ): AnonymousResourceCollection {
        /** @var User $user */
        $user = $request->user();
        $portee = $mandats->ownerScope($user->id);
        $recentes = $demandes->latestOf($portee);
        $lignes = [];

        foreach ($portee->visibles as $visible) {
            if ($visible->role === OwnerAccessRole::CoOwner) {
                continue;
            }

            $lignes[] = $contexte->run($visible->organizationId, function () use ($visible, $recentes, $parties, $comptes, $organisations, $porte): array {
                $actif = $parties->payoutAccount($visible->mandantPartyId);
                $demande = $recentes[$visible->organizationId.'|'.$visible->mandantPartyId] ?? null;
                $carence = $actif === null ? null : $actif->recordedAt->addDays((int) config('owner_funds.account_cooling_days'));

                return [
                    'access_id' => $visible->accessId,
                    'agency_id' => $visible->organizationId,
                    'agency_name' => $organisations->names([$visible->organizationId])[$visible->organizationId] ?? null,
                    'mandant_name' => $visible->mandantName,
                    'role' => $visible->role->value,
                    'can_request' => $porte->isWritable($visible),
                    'current' => $actif === null ? null : ['bank_last4' => $actif->last4, 'active_since' => $actif->recordedAt->toDateString()],
                    'cooling_until' => $carence !== null && $carence->greaterThan(CarbonImmutable::now()) ? $carence->toDateString() : null,
                    'contested' => PayoutHold::query()->where('mandant_party_id', $visible->mandantPartyId)->where('reason', HoldReason::AccountChangeContested->value)->whereNull('released_at')->exists(),
                    'request' => $demande === null ? null : (new OwnerPayoutRequestResource(['request' => $demande, 'account' => $comptes->state($demande->bank_account_id)]))->resolve(),
                ];
            });
        }

        return OwnerPayoutAccountResource::collection($lignes);
    }
}
