<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Http\Requests\ListMandantsRequest;
use App\Modules\Mandates\Http\Resources\MandantResource;
use App\Modules\Mandates\Queries\Mandants;
use Carbon\CarbonImmutable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListMandantsController
{
    public function __invoke(ListMandantsRequest $request, Mandants $mandants): AnonymousResourceCollection
    {
        return MandantResource::collection($mandants->list($request->afterPartyId(), $request->limit(), CarbonImmutable::today()));
    }
}
