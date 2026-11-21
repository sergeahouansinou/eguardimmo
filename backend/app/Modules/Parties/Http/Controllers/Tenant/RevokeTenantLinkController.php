<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Tenant;

use App\Modules\Identity\Enums\TenantRevoker;
use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\RevokeTenantAccess;
use App\Modules\Parties\Data\LinkedPartyData;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\PublicApi\PartyLinks;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RevokeTenantLinkController
{
    public function __invoke(string $party, Request $request, PartyLinks $liens, CurrentOrganization $contexte, RevokeTenantAccess $revoquer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $lien = collect($liens->linkedTo($user->id))->first(fn (LinkedPartyData $l): bool => $l->partyId === strtolower($party))
            ?? throw ErrorCode::TenantAccessNotFound->problem();

        $contexte->run($lien->organizationId, function () use ($lien, $user, $revoquer): void {
            $partie = Party::query()->find($lien->partyId) ?? throw ErrorCode::TenantAccessNotFound->problem();
            $revoquer->handle($partie, TenantRevoker::Account, $user->id);
        });

        return new JsonResponse(null, 204);
    }
}
