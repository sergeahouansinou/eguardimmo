<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Http\Requests\ListPageRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutBatchResource;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListBatchesController
{
    public function __invoke(ListPageRequest $request): AnonymousResourceCollection
    {
        return PayoutBatchResource::collection(PayoutBatch::query()->orderByDesc('id')->cursorPaginate($request->perPage()));
    }
}
