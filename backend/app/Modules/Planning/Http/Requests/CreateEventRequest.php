<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Requests;

use App\Modules\Planning\Data\NewEventData;
use App\Modules\Planning\Enums\EventKind;
use App\Modules\Planning\Enums\Recurrence;
use App\Modules\Planning\Support\EventRules;
use Illuminate\Foundation\Http\FormRequest;

final class CreateEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Ni `organization_id`, ni `created_by_user_id`, ni `timezone`, ni `next_reminder_at` : ils ne se lisent jamais du client.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return EventRules::fields(true);
    }

    public function toData(): NewEventData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        $participants = array_values(array_filter((array) ($v['attendees'] ?? []), is_array(...)));

        return new NewEventData(
            kind: EventKind::from((string) $v['kind']),
            title: trim((string) $v['title']),
            notes: $this->texte($v['notes'] ?? null),
            startsOn: (string) $v['starts_on'],
            startTime: isset($v['start_time']) ? $v['start_time'].':00' : null,
            recurrence: Recurrence::from((string) ($v['recurrence'] ?? 'none')),
            recurrenceUntil: isset($v['recurrence_until']) ? (string) $v['recurrence_until'] : null,
            reminderOffsetMinutes: isset($v['reminder_offset_minutes']) ? (int) $v['reminder_offset_minutes'] : null,
            propertyId: isset($v['property_id']) ? (string) $v['property_id'] : null,
            unitId: isset($v['unit_id']) ? (string) $v['unit_id'] : null,
            leaseId: isset($v['lease_id']) ? (string) $v['lease_id'] : null,
            attendeeUserIds: array_values(array_map(fn (array $p): string => (string) $p['user_id'], array_filter($participants, fn (array $p): bool => ! empty($p['user_id'])))),
            attendeePartyIds: array_values(array_map(fn (array $p): string => (string) $p['party_id'], array_filter($participants, fn (array $p): bool => ! empty($p['party_id'])))),
        );
    }

    private function texte(mixed $valeur): ?string
    {
        return is_string($valeur) && trim($valeur) !== '' ? trim($valeur) : null;
    }
}
