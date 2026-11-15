<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Actions\UpdateSecurityPolicy;
use App\Modules\Organizations\Http\Requests\UpdateSecurityRequest;
use App\Modules\Organizations\Http\Resources\OrganizationResource;
use App\Modules\Organizations\Support\OrganizationContext;

final class UpdateSecurityController
{
    public function __invoke(UpdateSecurityRequest $request, UpdateSecurityPolicy $modifier): OrganizationResource
    {
        return new OrganizationResource($modifier->handle(OrganizationContext::organization($request), $request->boolean('two_factor_required')));
    }
}
