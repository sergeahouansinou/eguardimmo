<?php

declare(strict_types=1);

namespace App\Modules\Properties\Queries;

use App\Modules\Catalog\PublicApi\Tagger;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Support\PropertyView;

final readonly class PropertyDetails
{
    public function __construct(
        private Properties $properties,
        private Tagger $etiqueteuse,
    ) {}

    public function get(string $id): PropertyView
    {
        return $this->of($this->properties->get($id));
    }

    public function of(Property $property): PropertyView
    {
        $property = $this->properties->get($property->id);

        return new PropertyView($property, $this->etiqueteuse->tagsOf($property->getMorphClass(), $property->id));
    }
}
