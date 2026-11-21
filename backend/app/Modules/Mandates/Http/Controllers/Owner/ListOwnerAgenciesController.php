<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Http\Requests\ListOwnerAgenciesRequest;
use App\Modules\Mandates\Http\Resources\Owner\OwnerAgencyResource;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListOwnerAgenciesController
{
    public function __invoke(ListOwnerAgenciesRequest $request, MandateDirectory $mandats, OrganizationDirectory $organisations): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();
        $agence = $request->agency();
        $visibles = $mandats->visibleToOwner($user->id, $agence);

        if ($agence !== null && $visibles === []) {
            throw ErrorCode::OwnerAgencyNotFound->problem();
        }

        $noms = $organisations->names(array_values(array_unique(array_map(fn (OwnerVisibleData $v): string => $v->organizationId, $visibles))));

        return OwnerAgencyResource::collection(array_map(fn (OwnerVisibleData $v): array => [
            'visible' => $v,
            'agency_name' => $noms[$v->organizationId] ?? null,
        ], $visibles));
    }
}
