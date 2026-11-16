<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Http\Resources\UnitResource;
use App\Modules\Properties\Queries\UnitDetails;

final class ShowUnitController
{
    public function __invoke(string $unit, UnitDetails $details): UnitResource
    {
        return new UnitResource($details->get($unit));
    }
}
