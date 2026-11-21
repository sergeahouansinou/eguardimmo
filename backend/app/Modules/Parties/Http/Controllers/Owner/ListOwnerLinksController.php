<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\Data\OwnerLinkData;
use App\Modules\Parties\Http\Resources\Owner\OwnerLinkResource;
use App\Modules\Parties\PublicApi\OwnerLinks;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListOwnerLinksController
{
    public function __invoke(Request $request, OwnerLinks $liens, OrganizationDirectory $organisations): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();
        $acces = $liens->activeFor($user->id);
        $noms = $organisations->names(array_values(array_unique(array_map(fn (OwnerLinkData $l): string => $l->organizationId, $acces))));

        return OwnerLinkResource::collection(array_map(fn (OwnerLinkData $l): array => [
            'id' => $l->accessId,
            'role' => $l->role->value,
            'organization' => ['id' => $l->organizationId, 'name' => $noms[$l->organizationId] ?? null],
            'mandant' => ['name' => $l->mandantName],
            'linked_at' => $l->linkedAt->toIso8601String(),
        ], $acces));
    }
}
