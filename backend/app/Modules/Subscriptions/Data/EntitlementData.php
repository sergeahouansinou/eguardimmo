<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Data;

final readonly class EntitlementData
{
    public function __construct(
        public string $feature,
        public bool $enabled,
        public ?int $limit,
        public string $source,
    ) {}
}
