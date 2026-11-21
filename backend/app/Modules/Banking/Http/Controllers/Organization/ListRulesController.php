<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Http\Requests\ListPageRequest;
use App\Modules\Banking\Http\Resources\BankRuleResource;
use App\Modules\Banking\Models\BankRule;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListRulesController
{
    public function __invoke(ListPageRequest $request): AnonymousResourceCollection
    {
        return BankRuleResource::collection(BankRule::query()->orderBy('position')->orderBy('id')->cursorPaginate($request->perPage()));
    }
}
