<?php

declare(strict_types=1);

namespace App\Modules\Properties\Support;

use App\Modules\Catalog\Data\TagData;
use App\Modules\Properties\Models\Property;

final readonly class PropertyView
{
    /**
     * @param  list<TagData>|null  $tags  null dans une liste : les étiquettes ne sont lues que pour le détail
     */
    public function __construct(
        public Property $property,
        public ?array $tags,
    ) {}
}
