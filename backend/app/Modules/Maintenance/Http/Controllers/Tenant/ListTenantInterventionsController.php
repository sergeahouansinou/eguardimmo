<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Http\Requests\ListTenantInterventionsRequest;
use App\Modules\Maintenance\Http\Resources\Tenant\TenantInterventionPageResource;
use App\Modules\Maintenance\Queries\TenantInterventions;
use App\Modules\Maintenance\Queries\TenantInterventionViews;
use App\Modules\Maintenance\Support\TenantAccess;

final class ListTenantInterventionsController
{
    public function __invoke(ListTenantInterventionsRequest $request, TenantAccess $acces, TenantInterventions $lecture, TenantInterventionViews $vues): TenantInterventionPageResource
    {
        /** @var User $user */
        $user = $request->user();
        $page = $lecture->page($acces->keys($user->id), $request->cursor(), $request->perPage());

        return new TenantInterventionPageResource($page, $vues->build($page->getCollection(), false));
    }
}
