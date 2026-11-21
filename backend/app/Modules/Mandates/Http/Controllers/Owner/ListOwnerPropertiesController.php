<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Http\Requests\ListOwnerPropertiesRequest;
use App\Modules\Mandates\Http\Resources\Owner\OwnerPropertyPageResource;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Mandates\Queries\OwnerUnits;
use App\Modules\Mandates\Queries\OwnerUnitViews;

final class ListOwnerPropertiesController
{
    public function __invoke(ListOwnerPropertiesRequest $request, MandateDirectory $repertoire, OwnerUnits $lots, OwnerUnitViews $vues): OwnerPropertyPageResource
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $repertoire->ownerScope($user->id, $request->agency());
        $page = $lots->page($portee, $request->perPage(), $request->cursor());

        return new OwnerPropertyPageResource($page, $vues->of($portee, array_values($page->items())));
    }
}
