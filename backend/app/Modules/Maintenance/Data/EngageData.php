<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

final readonly class EngageData
{
    public function __construct(
        public string $basis,
        public ?string $reason,
        public int $lockVersion,
    ) {}
}
