<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Enums\ErrorCode;
use App\Modules\Inspections\Http\Requests\ListCursorRequest;
use App\Modules\Inspections\Http\Resources\Tenant\TenantInspectionRemarkResource;
use App\Modules\Inspections\Queries\TenantInspections;
use Carbon\CarbonImmutable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTenantInspectionRemarksController
{
    public function __invoke(string $inspection, ListCursorRequest $request, TenantInspections $etats): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();
        $trouve = $etats->find($user->id, $inspection, CarbonImmutable::today()) ?? throw ErrorCode::InspectionNotFound->problem();

        return TenantInspectionRemarkResource::collection($etats->remarks($trouve['position'], $trouve['inspection'], $request->perPage(), $request->cursor()));
    }
}
