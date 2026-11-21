<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests;

use App\Modules\Notifications\Data\PreferenceChange;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SavePreferencesRequest extends FormRequest
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
        return [
            'preferences' => ['required', 'array', 'min:1', 'max:'.(count(NotificationType::cases()) * count(NotificationChannel::cases()))],
            'preferences.*' => ['required', 'array:type,channel,enabled'],
            'preferences.*.type' => ['required', 'string', Rule::enum(NotificationType::class)],
            'preferences.*.channel' => ['required', 'string', Rule::enum(NotificationChannel::class)],
            'preferences.*.enabled' => ['required', 'boolean'],
        ];
    }

    /**
     * @return list<PreferenceChange>
     */
    public function toData(): array
    {
        /** @var list<array{type: string, channel: string, enabled: bool|int|string}> $lignes */
        $lignes = $this->validated('preferences');

        return array_map(fn (array $ligne): PreferenceChange => new PreferenceChange(
            NotificationType::from($ligne['type']),
            NotificationChannel::from($ligne['channel']),
            filter_var($ligne['enabled'], FILTER_VALIDATE_BOOLEAN),
        ), $lignes);
    }
}
