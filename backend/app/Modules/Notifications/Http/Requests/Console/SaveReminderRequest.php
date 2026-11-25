<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests\Console;

use App\Modules\Notifications\Data\ReminderSettings;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Enums\NotificationChannel;
use App\Modules\Notifications\Enums\ReminderCode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SaveReminderRequest extends FormRequest
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
        $code = $this->reminderCode();
        $bornes = $code->defaults();
        $canaux = array_map(fn (NotificationChannel $canal): string => $canal->value, $code->availableChannels());

        return [
            'enabled' => ['required', 'boolean'],
            'delay_days' => ['required', 'integer', 'min:'.$bornes['min'], 'max:'.$bornes['max']],
            'repeat_every_days' => ['present', 'nullable', 'integer', 'min:1', 'max:180'],
            'max_occurrences' => ['required', 'integer', 'min:1', 'max:'.$code->occurrencesLimit()],
            'channels' => ['required', 'array', 'list', 'min:1'],
            'channels.*' => ['required', 'string', 'distinct', Rule::in($canaux)],
        ];
    }

    public function reminderCode(): ReminderCode
    {
        return ReminderCode::tryFrom((string) $this->route('code')) ?? throw ErrorCode::ReminderNotFound->problem();
    }

    public function toData(): ReminderSettings
    {
        $code = $this->reminderCode();
        /** @var list<string> $canaux */
        $canaux = $this->validated('channels');
        $repetition = $this->validated('repeat_every_days') === null ? null : $this->integer('repeat_every_days');

        return new ReminderSettings(
            $code,
            $this->boolean('enabled'),
            $this->integer('delay_days'),
            $repetition,
            $repetition === null ? 1 : $this->integer('max_occurrences'),
            array_values(array_filter($code->availableChannels(), fn (NotificationChannel $canal): bool => in_array($canal->value, $canaux, true))),
        );
    }
}
