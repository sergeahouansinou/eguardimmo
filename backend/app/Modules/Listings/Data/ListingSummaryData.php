<?php

declare(strict_types=1);

namespace App\Modules\Listings\Data;

final readonly class ListingSummaryData
{
    public function __construct(
        public string $id,
        public string $ref,
        public string $title,
        public ?string $cityName,
        public ?string $neighbourhood,
        public ?string $hostName,
    ) {}
}
