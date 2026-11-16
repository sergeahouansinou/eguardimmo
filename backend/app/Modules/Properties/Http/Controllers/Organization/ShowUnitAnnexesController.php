<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Http\Resources\UnitTreeResource;
use App\Modules\Properties\Queries\UnitDetails;
use App\Modules\Properties\Queries\Units;

final class ShowUnitAnnexesController
{
    public function __invoke(string $unit, Units $units, UnitDetails $details): UnitTreeResource
    {
        return new UnitTreeResource($details->tree($units->get($unit)));
    }
}
