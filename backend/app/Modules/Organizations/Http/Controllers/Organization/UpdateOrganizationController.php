<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Actions\UpdateOrganizationTimezone;
use App\Modules\Organizations\Http\Requests\UpdateOrganizationRequest;
use App\Modules\Organizations\Http\Resources\OrganizationResource;
use App\Modules\Organizations\Support\OrganizationContext;

final class UpdateOrganizationController
{
    public function __invoke(UpdateOrganizationRequest $request, UpdateOrganizationTimezone $modifier): OrganizationResource
    {
        return new OrganizationResource($modifier->handle(OrganizationContext::organization($request), $request->timezone()));
    }
}
