<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Http\Requests\ListTenantLeasesRequest;
use App\Modules\Leases\Http\Resources\Tenant\TenantLeasePageResource;
use App\Modules\Leases\Queries\TenantLeases;
use App\Modules\Leases\Queries\TenantLeaseViews;
use Carbon\CarbonImmutable;

final class ListTenantLeasesController
{
    public function __invoke(ListTenantLeasesRequest $request, TenantLeases $baux, TenantLeaseViews $vues): TenantLeasePageResource
    {
        /** @var User $user */
        $user = $request->user();
        $today = CarbonImmutable::today();
        $page = $baux->page($user->id, $request->perPage(), $request->cursor(), $today);

        return new TenantLeasePageResource($page, $vues->summaries($user->id, $page->items(), $today));
    }
}
