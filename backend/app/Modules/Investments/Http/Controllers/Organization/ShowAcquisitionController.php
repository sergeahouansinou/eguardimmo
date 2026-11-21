<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Controllers\Organization;

use App\Modules\Investments\Http\Resources\AcquisitionResource;
use App\Modules\Investments\Queries\Loans;

final class ShowAcquisitionController
{
    public function __invoke(string $acquisition, Loans $prets): AcquisitionResource
    {
        return new AcquisitionResource($prets->acquisition($acquisition));
    }
}
