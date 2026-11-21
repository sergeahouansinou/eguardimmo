<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Http\Requests\ListLinesRequest;
use App\Modules\Banking\Http\Resources\BankStatementLineResource;
use App\Modules\Banking\Queries\BankLines;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListLinesController
{
    public function __invoke(ListLinesRequest $request, BankLines $lignes): AnonymousResourceCollection
    {
        $page = $lignes->decorate($lignes->query($request->validated())->cursorPaginate($request->perPage()));

        return BankStatementLineResource::collection($page);
    }
}
