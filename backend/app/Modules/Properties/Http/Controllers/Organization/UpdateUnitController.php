<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\UpdateUnit;
use App\Modules\Properties\Http\Requests\UpdateUnitRequest;
use App\Modules\Properties\Http\Resources\UnitResource;
use App\Modules\Properties\Queries\UnitDetails;
use App\Modules\Properties\Queries\Units;

final class UpdateUnitController
{
    public function __invoke(string $unit, UpdateUnitRequest $request, Units $units, UpdateUnit $modifier, UnitDetails $details): UnitResource
    {
        return new UnitResource($details->of($modifier->handle($units->get($unit), $request->toData())));
    }
}
