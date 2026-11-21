<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Http\Requests\ListCursorRequest;
use App\Modules\Inspections\Http\Resources\Tenant\TenantInspectionPageResource;
use App\Modules\Inspections\Queries\TenantInspections;
use App\Modules\Inspections\Queries\TenantInspectionViews;
use Carbon\CarbonImmutable;

final class ListTenantInspectionsController
{
    public function __invoke(ListCursorRequest $request, TenantInspections $etats, TenantInspectionViews $vues): TenantInspectionPageResource
    {
        /** @var User $user */
        $user = $request->user();
        $today = CarbonImmutable::today();
        $page = $etats->page($user->id, $request->perPage(), $request->cursor(), $today);

        return new TenantInspectionPageResource($page, $vues->of(array_values($page->items()), $user->id, $today));
    }
}
