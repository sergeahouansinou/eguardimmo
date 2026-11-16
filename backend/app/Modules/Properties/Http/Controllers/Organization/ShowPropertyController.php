<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Http\Resources\PropertyResource;
use App\Modules\Properties\Queries\PropertyDetails;

final class ShowPropertyController
{
    public function __invoke(string $property, PropertyDetails $details): PropertyResource
    {
        return new PropertyResource($details->get($property));
    }
}
