<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Requests;

use App\Modules\Planning\Data\EventChangesData;
use App\Modules\Planning\Support\EventRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;

final class UpdateEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return ['lock_version' => ['required', 'integer', 'min:1'], ...EventRules::fields(false)];
    }

    public function toData(): EventChangesData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        $champs = Arr::except($v, ['lock_version', 'attendees']);

        foreach (['title', 'notes'] as $cle) {
            if (array_key_exists($cle, $champs)) {
                $champs[$cle] = is_string($champs[$cle]) && trim($champs[$cle]) !== '' ? trim($champs[$cle]) : null;
            }
        }

        if (isset($champs['start_time'])) {
            $champs['start_time'] .= ':00';
        }

        $participants = array_key_exists('attendees', $v) ? array_values(array_filter((array) $v['attendees'], is_array(...))) : null;

        return new EventChangesData(
            lockVersion: (int) $v['lock_version'],
            fields: $champs,
            attendeeUserIds: $participants === null ? null : array_values(array_map(fn (array $p): string => (string) $p['user_id'], array_filter($participants, fn (array $p): bool => ! empty($p['user_id'])))),
            attendeePartyIds: $participants === null ? null : array_values(array_map(fn (array $p): string => (string) $p['party_id'], array_filter($participants, fn (array $p): bool => ! empty($p['party_id'])))),
        );
    }
}
