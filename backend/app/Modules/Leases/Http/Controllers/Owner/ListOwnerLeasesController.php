<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Http\Requests\ListOwnerLeasesRequest;
use App\Modules\Leases\Http\Resources\Owner\OwnerLeasePageResource;
use App\Modules\Leases\Queries\OwnerLeases;
use App\Modules\Leases\Queries\OwnerLeaseViews;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use Carbon\CarbonImmutable;

final class ListOwnerLeasesController
{
    public function __invoke(ListOwnerLeasesRequest $request, MandateDirectory $mandats, OwnerLeases $baux, OwnerLeaseViews $vues): OwnerLeasePageResource
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $mandats->ownerScope($user->id, $request->agency());
        $page = $baux->page($portee, $request->perPage(), $request->cursor());

        return new OwnerLeasePageResource($page, $vues->summaries($portee, $page->items(), CarbonImmutable::today()));
    }
}
