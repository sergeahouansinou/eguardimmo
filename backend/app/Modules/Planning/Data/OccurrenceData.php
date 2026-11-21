<?php

declare(strict_types=1);

namespace App\Modules\Planning\Data;

use App\Modules\Planning\Enums\EventKind;
use App\Modules\Planning\Enums\Recurrence;
use Carbon\CarbonImmutable;

final readonly class OccurrenceData
{
    public function __construct(
        public string $eventId,
        public string $occurrenceOn,
        public EventKind $kind,
        public string $title,
        public ?string $startTime,
        public ?string $timezone,
        public ?CarbonImmutable $startsAt,
        public Recurrence $recurrence,
        public ?string $propertyId,
        public ?string $unitId,
        public ?string $leaseId,
    ) {}
}
