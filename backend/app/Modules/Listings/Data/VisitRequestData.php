<?php

declare(strict_types=1);

namespace App\Modules\Listings\Data;

final readonly class VisitRequestData
{
    public function __construct(
        public string $requestedSlot,
        public ?string $message,
    ) {}
}
