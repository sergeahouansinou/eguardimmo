<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Http\Resources\RoleMatrixResource;
use App\Modules\Organizations\Support\OrganizationContext;
use App\Modules\Organizations\Support\RoleMatrix;
use Illuminate\Http\Request;

final class ListRolesController
{
    public function __invoke(Request $request): RoleMatrixResource
    {
        return new RoleMatrixResource(RoleMatrix::domains(), OrganizationContext::member($request)->role);
    }
}
