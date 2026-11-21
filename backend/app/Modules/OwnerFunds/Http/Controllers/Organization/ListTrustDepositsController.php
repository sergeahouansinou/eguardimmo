<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Http\Requests\ListPageRequest;
use App\Modules\OwnerFunds\Http\Resources\TrustDepositResource;
use App\Modules\OwnerFunds\Models\TrustDepositRequest;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTrustDepositsController
{
    public function __invoke(ListPageRequest $request): AnonymousResourceCollection
    {
        return TrustDepositResource::collection(TrustDepositRequest::query()->orderByDesc('id')->cursorPaginate($request->perPage()));
    }
}
