<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Http\Requests\ListUnitsRequest;
use App\Modules\Properties\Http\Resources\UnitPageResource;
use App\Modules\Properties\Queries\UnitDetails;
use App\Modules\Properties\Queries\Units;

final class ListUnitsController
{
    public function __invoke(ListUnitsRequest $request, Units $units, UnitDetails $details): UnitPageResource
    {
        $page = $units->list($request->filters(), $request->perPage());

        return new UnitPageResource($page, $details->typesOf($page->items()));
    }
}
