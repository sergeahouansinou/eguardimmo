<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Enums\ErrorCode;
use App\Modules\Inspections\Http\Resources\Tenant\TenantInspectionResource;
use App\Modules\Inspections\Queries\TenantInspections;
use App\Modules\Inspections\Queries\TenantInspectionViews;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowTenantInspectionController
{
    public function __invoke(string $inspection, Request $request, TenantInspections $etats, TenantInspectionViews $vues): TenantInspectionResource
    {
        /** @var User $user */
        $user = $request->user();
        $today = CarbonImmutable::today();
        $trouve = $etats->find($user->id, $inspection, $today) ?? throw ErrorCode::InspectionNotFound->problem();

        return new TenantInspectionResource($vues->of([$trouve['inspection']], $user->id, $today)[0]);
    }
}
