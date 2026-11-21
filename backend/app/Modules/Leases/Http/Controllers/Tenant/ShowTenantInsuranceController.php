<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Http\Resources\Tenant\TenantInsuranceResource;
use App\Modules\Leases\Queries\InsuranceOverviews;
use App\Modules\Leases\Queries\TenantStandings;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowTenantInsuranceController
{
    public function __invoke(string $lease, Request $request, TenantStandings $positions, InsuranceOverviews $vues): TenantInsuranceResource
    {
        /** @var User $user */
        $user = $request->user();
        $position = $positions->find($user->id, $lease, CarbonImmutable::today()) ?? throw ErrorCode::LeaseNotFound->problem();

        return new TenantInsuranceResource($vues->forTenant($position));
    }
}
