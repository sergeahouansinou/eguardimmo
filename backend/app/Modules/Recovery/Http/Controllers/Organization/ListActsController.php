<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Http\Requests\ListActsRequest;
use App\Modules\Recovery\Http\Resources\ActPageResource;
use App\Modules\Recovery\Queries\CaseActs;
use App\Modules\Recovery\Queries\Cases;

final class ListActsController
{
    public function __invoke(string $case, ListActsRequest $request, Cases $dossiers, CaseActs $actes): ActPageResource
    {
        return new ActPageResource($actes->page($dossiers->find($case), $request->perPage(), $request->cursor()));
    }
}
