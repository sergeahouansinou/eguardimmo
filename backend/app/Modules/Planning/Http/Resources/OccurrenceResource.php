<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Resources;

use App\Modules\Planning\Data\OccurrenceData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Une occurrence ne porte ni notes ni participants : ils se lisent sur l'événement.
 *
 * @property OccurrenceData $resource
 */
final class OccurrenceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $o = $this->resource;

        return [
            'event_id' => $o->eventId,
            'occurrence_on' => $o->occurrenceOn,
            'kind' => $o->kind->value,
            'title' => $o->title,
            'start_time' => $o->startTime,
            'timezone' => $o->timezone,
            'all_day' => $o->startTime === null,
            'starts_at' => $o->startsAt?->toIso8601ZuluString(),
            'recurrence' => $o->recurrence->value,
            'property_id' => $o->propertyId,
            'unit_id' => $o->unitId,
            'lease_id' => $o->leaseId,
        ];
    }
}
