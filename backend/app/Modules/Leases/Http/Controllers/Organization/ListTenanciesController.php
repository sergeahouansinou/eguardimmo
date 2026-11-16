<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Leases\Http\Requests\TenanciesRequest;
use App\Modules\Leases\Http\Resources\TenancyResource;
use App\Modules\Leases\Queries\Tenancies;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTenanciesController
{
    public function __invoke(TenanciesRequest $request, Tenancies $tenancies): AnonymousResourceCollection
    {
        return TenancyResource::collection($tenancies->of($request->partyIds()));
    }
}
