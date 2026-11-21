<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Maintenance\Enums\VisitSlot;

final readonly class VisitData
{
    public function __construct(
        public string $scheduledOn,
        public VisitSlot $slot,
        public bool $presenceRequired,
        public ?string $contactName,
        public ?string $contactPhone,
    ) {}
}
