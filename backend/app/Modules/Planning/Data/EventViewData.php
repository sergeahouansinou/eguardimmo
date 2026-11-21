<?php

declare(strict_types=1);

namespace App\Modules\Planning\Data;

use App\Modules\Planning\Enums\EventKind;
use App\Modules\Planning\Enums\Recurrence;
use Carbon\CarbonInterface;

final readonly class EventViewData
{
    /**
     * @param  list<array{user_id: string|null, party_id: string|null}>  $attendees
     */
    public function __construct(
        public string $id,
        public EventKind $kind,
        public string $title,
        public ?string $notes,
        public string $startsOn,
        public ?string $startTime,
        public ?string $timezone,
        public Recurrence $recurrence,
        public ?string $recurrenceUntil,
        public ?int $reminderOffsetMinutes,
        public ?string $propertyId,
        public ?string $unitId,
        public ?string $leaseId,
        public array $attendees,
        public string $createdByUserId,
        public ?CarbonInterface $cancelledAt,
        public int $lockVersion,
    ) {}
}
