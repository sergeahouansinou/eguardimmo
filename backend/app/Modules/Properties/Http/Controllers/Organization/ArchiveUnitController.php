<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\ArchiveUnit;
use App\Modules\Properties\Http\Resources\UnitResource;
use App\Modules\Properties\Queries\UnitDetails;
use App\Modules\Properties\Queries\Units;

final class ArchiveUnitController
{
    public function __invoke(string $unit, Units $units, ArchiveUnit $action, UnitDetails $details): UnitResource
    {
        return new UnitResource($details->of($action->handle($units->get($unit))));
    }
}
