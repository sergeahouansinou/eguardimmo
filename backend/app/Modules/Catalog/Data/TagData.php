<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Data;

final readonly class TagData
{
    public function __construct(
        public string $id,
        public string $name,
        public string $slug,
        public ?string $color,
    ) {}
}
