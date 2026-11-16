<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Controllers\Organization;

use App\Modules\Properties\Actions\ArchiveProperty;
use App\Modules\Properties\Http\Resources\PropertyResource;
use App\Modules\Properties\Queries\Properties;
use App\Modules\Properties\Queries\PropertyDetails;

final class ArchivePropertyController
{
    public function __invoke(string $property, Properties $properties, ArchiveProperty $action, PropertyDetails $details): PropertyResource
    {
        return new PropertyResource($details->of($action->handle($properties->get($property))));
    }
}
