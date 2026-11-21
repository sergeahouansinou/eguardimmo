<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use Carbon\CarbonImmutable;

final readonly class ReminderSlot
{
    public function __construct(
        public CarbonImmutable $at,
        public string $occurrenceOn,
    ) {}
}
