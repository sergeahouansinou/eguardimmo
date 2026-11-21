<?php

declare(strict_types=1);

namespace App\Modules\Planning\Data;

final readonly class EventChangesData
{
    /**
     * @param  array<string, mixed>  $fields  colonnes transmises seulement : kind, title, notes, starts_on, start_time, recurrence, recurrence_until, reminder_offset_minutes, property_id, unit_id, lease_id
     * @param  list<string>|null  $attendeeUserIds  null : inchangés
     * @param  list<string>|null  $attendeePartyIds  null : inchangées
     */
    public function __construct(
        public int $lockVersion,
        public array $fields,
        public ?array $attendeeUserIds,
        public ?array $attendeePartyIds,
    ) {}
}
