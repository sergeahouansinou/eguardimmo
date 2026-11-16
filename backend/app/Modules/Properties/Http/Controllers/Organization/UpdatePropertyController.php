<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\UpdateProperty;
use App\Modules\Properties\Http\Requests\UpdatePropertyRequest;
use App\Modules\Properties\Http\Resources\PropertyResource;
use App\Modules\Properties\Queries\Properties;
use App\Modules\Properties\Queries\PropertyDetails;

final class UpdatePropertyController
{
    public function __invoke(string $property, UpdatePropertyRequest $request, Properties $properties, UpdateProperty $modifier, PropertyDetails $details): PropertyResource
    {
        return new PropertyResource($details->of($modifier->handle($properties->get($property), $request->toData())));
    }
}
