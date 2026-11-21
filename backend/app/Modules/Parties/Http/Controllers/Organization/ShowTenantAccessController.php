<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Parties\Http\Resources\TenantAccessResource;
use App\Modules\Parties\Queries\Parties;
use App\Modules\Parties\Queries\TenantAccesses;

final class ShowTenantAccessController
{
    public function __invoke(string $party, Parties $parties, TenantAccesses $acces): TenantAccessResource
    {
        return new TenantAccessResource($acces->of($parties->get($party)));
    }
}
