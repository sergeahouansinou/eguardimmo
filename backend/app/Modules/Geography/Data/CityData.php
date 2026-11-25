<?php

declare(strict_types=1);

namespace App\Modules\Geography\Data;

final readonly class CityData
{
    public function __construct(
        public string $id,
        public string $slug,
        public string $name,
        public string $postalCode,
        public string $countryCode,
    ) {}
}
