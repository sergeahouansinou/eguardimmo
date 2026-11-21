<?php

declare(strict_types=1);

namespace App\Modules\Planning\Data;

use App\Modules\Planning\Enums\EventKind;
use App\Modules\Planning\Enums\Recurrence;

final readonly class NewEventData
{
    /**
     * @param  list<string>  $attendeeUserIds
     * @param  list<string>  $attendeePartyIds
     */
    public function __construct(
        public EventKind $kind,
        public string $title,
        public ?string $notes,
        public string $startsOn,
        public ?string $startTime,
        public Recurrence $recurrence,
        public ?string $recurrenceUntil,
        public ?int $reminderOffsetMinutes,
        public ?string $propertyId,
        public ?string $unitId,
        public ?string $leaseId,
        public array $attendeeUserIds,
        public array $attendeePartyIds,
    ) {}
}
