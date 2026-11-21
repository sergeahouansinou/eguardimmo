<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use App\Modules\Planning\Enums\TaskStatus;
use Illuminate\Validation\Rule;

final class TaskRules
{
    /**
     * @return array<string, list<mixed>>
     */
    public static function fields(bool $creation): array
    {
        $presence = $creation ? ['required'] : ['sometimes'];

        return [
            'title' => [...$presence, 'string', 'min:1', 'max:120', 'not_regex:/[<>]/'],
            'due_on' => [...$presence, 'date_format:Y-m-d', 'after:2000-01-01', 'before:2100-01-01'],
            'assignee_user_id' => ['nullable', 'uuid'],
            'remind_days_before' => ['nullable', 'integer', 'min:0', 'max:90'],
            'property_id' => ['nullable', 'uuid'],
            'unit_id' => ['nullable', 'uuid'],
            'lease_id' => ['nullable', 'uuid'],
        ];
    }

    /**
     * @return array<string, list<mixed>>
     */
    public static function filters(bool $debutPresent): array
    {
        return [
            'status' => ['nullable', Rule::enum(TaskStatus::class)],
            'assignee' => ['nullable', 'string', 'regex:/^(me|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i'],
            'property' => ['nullable', 'uuid'],
            'unit' => ['nullable', 'uuid'],
            'due_from' => ['nullable', 'date_format:Y-m-d'],
            'due_to' => ['nullable', 'date_format:Y-m-d', ...($debutPresent ? ['after:due_from'] : [])],
            'overdue' => ['nullable', 'boolean'],
        ];
    }
}
