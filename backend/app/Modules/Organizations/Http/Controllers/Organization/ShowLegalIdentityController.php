<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Http\Resources\LegalIdentityResource;
use App\Modules\Organizations\Queries\LegalIdentities;

final class ShowLegalIdentityController
{
    public function __invoke(LegalIdentities $identites): LegalIdentityResource
    {
        return new LegalIdentityResource($identites->current() ?? throw ErrorCode::LegalIdentityNotFound->problem());
    }
}
