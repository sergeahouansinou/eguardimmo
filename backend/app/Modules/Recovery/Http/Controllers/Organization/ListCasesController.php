<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Http\Requests\ListCasesRequest;
use App\Modules\Recovery\Http\Resources\CasePageResource;
use App\Modules\Recovery\Queries\CaseList;
use App\Modules\Recovery\Queries\CaseViews;

final class ListCasesController
{
    public function __invoke(ListCasesRequest $request, CaseList $liste, CaseViews $vues): CasePageResource
    {
        $page = $liste->list($request->filters(), $request->perPage());

        return new CasePageResource($page, $vues->of(array_values($page->items())));
    }
}
