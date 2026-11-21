<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Http\Resources\Tenant\TenantLeaseResource;
use App\Modules\Leases\Queries\TenantLeases;
use App\Modules\Leases\Queries\TenantLeaseViews;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowTenantLeaseController
{
    public function __invoke(string $lease, Request $request, TenantLeases $baux, TenantLeaseViews $vues): TenantLeaseResource
    {
        /** @var User $user */
        $user = $request->user();
        $today = CarbonImmutable::today();
        $bail = $baux->find($user->id, $lease, $today) ?? throw ErrorCode::LeaseNotFound->problem();

        return new TenantLeaseResource($vues->detail($user->id, $bail, $today));
    }
}
