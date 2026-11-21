<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Http\Requests\ListMandatesRequest;
use App\Modules\Mandates\Http\Resources\MandatePageResource;
use App\Modules\Mandates\Queries\MandateList;
use App\Modules\Mandates\Queries\MandateViews;

final class ListMandatesController
{
    public function __invoke(ListMandatesRequest $request, MandateList $list, MandateViews $views): MandatePageResource
    {
        $page = $list->list($request->filters(), $request->perPage());

        return new MandatePageResource($page, $views->of($page->items()));
    }
}
