<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Requests;

use App\Modules\Planning\Data\NewTaskData;
use App\Modules\Planning\Support\TaskRules;
use Illuminate\Foundation\Http\FormRequest;

final class CreateTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Ni `status`, ni `created_by_user_id`, ni `done_by_user_id`, ni `next_reminder_at` : ils ne se lisent jamais du client.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [...TaskRules::fields(true), 'client_id' => ['nullable', 'uuid']];
    }

    public function toData(): NewTaskData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewTaskData(
            title: trim((string) $v['title']),
            dueOn: (string) $v['due_on'],
            assigneeUserId: isset($v['assignee_user_id']) ? (string) $v['assignee_user_id'] : null,
            remindDaysBefore: isset($v['remind_days_before']) ? (int) $v['remind_days_before'] : null,
            propertyId: isset($v['property_id']) ? (string) $v['property_id'] : null,
            unitId: isset($v['unit_id']) ? (string) $v['unit_id'] : null,
            leaseId: isset($v['lease_id']) ? (string) $v['lease_id'] : null,
            clientId: isset($v['client_id']) ? (string) $v['client_id'] : null,
        );
    }
}
