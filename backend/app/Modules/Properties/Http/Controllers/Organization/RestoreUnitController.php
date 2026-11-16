<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\RestoreUnit;
use App\Modules\Properties\Http\Resources\UnitResource;
use App\Modules\Properties\Queries\UnitDetails;
use App\Modules\Properties\Queries\Units;

final class RestoreUnitController
{
    public function __invoke(string $unit, Units $units, RestoreUnit $action, UnitDetails $details): UnitResource
    {
        return new UnitResource($details->of($action->handle($units->get($unit))));
    }
}
