<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use App\Modules\Planning\Enums\EventKind;
use App\Modules\Planning\Enums\Recurrence;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class EventRules
{
    public const array RAPPELS = [60, 1440];

    /**
     * Cohérence d'un événement après fusion des champs reçus.
     *
     * @throws ValidationException
     */
    public static function assertCoherent(string $startsOn, Recurrence $recurrence, ?string $until): void
    {
        if ($recurrence === Recurrence::None && $until !== null) {
            throw ValidationException::withMessages(['recurrence_until' => ['Une fin de récurrence suppose un événement récurrent.']]);
        }

        if ($until !== null && $until < $startsOn) {
            throw ValidationException::withMessages(['recurrence_until' => ['La fin de la récurrence précède le début de l\'événement.']]);
        }
    }

    /**
     * Règles de format ; `$creation` rend obligatoires le type, le titre et la date.
     *
     * @return array<string, list<mixed>>
     */
    public static function fields(bool $creation): array
    {
        $presence = $creation ? ['required'] : ['sometimes'];

        return [
            'kind' => [...$presence, Rule::enum(EventKind::class)],
            'title' => [...$presence, 'string', 'min:1', 'max:120', 'not_regex:/[<>]/'],
            'notes' => ['nullable', 'string', 'max:1000', 'not_regex:/[<>]/'],
            'starts_on' => [...$presence, 'date_format:Y-m-d', 'after:2000-01-01', 'before:2100-01-01'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'recurrence' => ['sometimes', Rule::enum(Recurrence::class)],
            'recurrence_until' => ['nullable', 'date_format:Y-m-d', 'before:2100-01-01'],
            'reminder_offset_minutes' => ['nullable', 'integer', Rule::in(self::RAPPELS)],
            'property_id' => ['nullable', 'uuid'],
            'unit_id' => ['nullable', 'uuid'],
            'lease_id' => ['nullable', 'uuid'],
            'attendees' => ['sometimes', 'array', 'max:'.EventAttendees::MAX],
            'attendees.*' => ['array:user_id,party_id'],
            'attendees.*.user_id' => ['nullable', 'uuid', 'required_without:attendees.*.party_id', 'prohibits:attendees.*.party_id', 'distinct'],
            'attendees.*.party_id' => ['nullable', 'uuid', 'required_without:attendees.*.user_id', 'prohibits:attendees.*.user_id', 'distinct'],
        ];
    }
}
