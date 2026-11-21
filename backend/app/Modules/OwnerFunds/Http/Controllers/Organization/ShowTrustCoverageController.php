<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Http\Resources\TrustCoverageResource;
use App\Modules\OwnerFunds\Support\TrustGuard;

final class ShowTrustCoverageController
{
    public function __invoke(TrustGuard $cantonnement): TrustCoverageResource
    {
        return new TrustCoverageResource($cantonnement->coverage());
    }
}
