<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Http\Requests\ListOwnerMandatesRequest;
use App\Modules\Mandates\Http\Resources\Owner\OwnerMandatePageResource;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Mandates\Queries\OwnerMandates;
use App\Modules\Mandates\Queries\OwnerMandateViews;

final class ListOwnerMandatesController
{
    public function __invoke(ListOwnerMandatesRequest $request, MandateDirectory $repertoire, OwnerMandates $mandats, OwnerMandateViews $vues): OwnerMandatePageResource
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $repertoire->ownerScope($user->id, $request->agency());
        $page = $mandats->page($portee, $request->perPage(), $request->cursor());

        return new OwnerMandatePageResource($page, $vues->of($portee, $page->items()));
    }
}
