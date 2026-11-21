<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\Data\LinkedPartyData;
use App\Modules\Parties\Http\Resources\TenantLinkResource;
use App\Modules\Parties\PublicApi\PartyLinks;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTenantLinksController
{
    public function __invoke(Request $request, PartyLinks $liens, OrganizationDirectory $organisations): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();
        $rattachements = $liens->linkedTo($user->id);
        $noms = $organisations->names(array_map(fn (LinkedPartyData $lien): string => $lien->organizationId, $rattachements));

        return TenantLinkResource::collection(array_map(fn (LinkedPartyData $lien): array => [
            'id' => $lien->partyId,
            'organization' => ['id' => $lien->organizationId, 'name' => $noms[$lien->organizationId] ?? null],
        ], $rattachements));
    }
}
