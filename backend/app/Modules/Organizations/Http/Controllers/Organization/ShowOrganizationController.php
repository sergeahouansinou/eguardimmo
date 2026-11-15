<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Http\Resources\OrganizationResource;
use App\Modules\Organizations\Support\OrganizationContext;
use Illuminate\Http\Request;

final class ShowOrganizationController
{
    public function __invoke(Request $request): OrganizationResource
    {
        return new OrganizationResource(OrganizationContext::organization($request));
    }
}
