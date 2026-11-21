<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Resources;

use App\Modules\Planning\Data\EventViewData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property EventViewData $resource
 */
final class EventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $e = $this->resource;

        return [
            'id' => $e->id,
            'kind' => $e->kind->value,
            'title' => $e->title,
            'notes' => $e->notes,
            'starts_on' => $e->startsOn,
            'start_time' => $e->startTime,
            'timezone' => $e->timezone,
            'all_day' => $e->startTime === null,
            'recurrence' => $e->recurrence->value,
            'recurrence_until' => $e->recurrenceUntil,
            'reminder_offset_minutes' => $e->reminderOffsetMinutes,
            'property_id' => $e->propertyId,
            'unit_id' => $e->unitId,
            'lease_id' => $e->leaseId,
            'attendees' => $e->attendees,
            'created_by_user_id' => $e->createdByUserId,
            'cancelled_at' => $e->cancelledAt?->toIso8601String(),
            'lock_version' => $e->lockVersion,
        ];
    }
}
