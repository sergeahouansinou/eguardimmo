<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Actions\UpdateLegalIdentity;
use App\Modules\Organizations\Http\Requests\UpdateLegalIdentityRequest;
use App\Modules\Organizations\Http\Resources\LegalIdentityResource;
use App\Modules\Organizations\Support\OrganizationContext;

final class UpdateLegalIdentityController
{
    public function __invoke(UpdateLegalIdentityRequest $request, UpdateLegalIdentity $modifier): LegalIdentityResource
    {
        return new LegalIdentityResource($modifier->handle(OrganizationContext::organization($request), $request->toData()));
    }
}
