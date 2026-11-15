<?php

declare(strict_types=1);

namespace App\Modules\Properties\Data;

use App\Modules\Properties\Enums\PropertyType;

final readonly class PropertyFilters
{
    public function __construct(
        public ?string $search = null,
        public ?PropertyType $type = null,
        public string $status = 'active',
    ) {}
}
