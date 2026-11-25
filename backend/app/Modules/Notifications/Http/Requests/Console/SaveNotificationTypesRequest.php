<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests\Console;

use App\Modules\Notifications\Data\PreferenceChange;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\NotificationType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SaveNotificationTypesRequest extends FormRequest
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
        $types = array_map(fn (NotificationType $type): string => $type->value, NotificationType::configurable());

        return [
            'changes' => ['required', 'array', 'list', 'min:1', 'max:'.(count($types) * count(NotificationChannel::cases()))],
            'changes.*' => ['required', 'array:type,channel,enabled'],
            'changes.*.type' => ['required', 'string', Rule::in($types)],
            'changes.*.channel' => ['required', 'string', Rule::enum(NotificationChannel::class)],
            'changes.*.enabled' => ['required', 'boolean'],
        ];
    }

    /**
     * @return list<PreferenceChange>
     */
    public function toData(): array
    {
        /** @var list<array{type: string, channel: string, enabled: bool|int|string}> $lignes */
        $lignes = $this->validated('changes');

        return array_map(fn (array $ligne): PreferenceChange => new PreferenceChange(
            NotificationType::from($ligne['type']),
            NotificationChannel::from($ligne['channel']),
            filter_var($ligne['enabled'], FILTER_VALIDATE_BOOLEAN),
        ), $lignes);
    }
}
