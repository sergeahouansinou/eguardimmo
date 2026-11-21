<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Requests;

use App\Modules\Planning\Data\TaskFilters;
use App\Modules\Planning\Enums\TaskStatus;
use App\Modules\Planning\Support\TaskRules;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;

final class ListTasksRequest extends FormRequest
{
    use PaginatesWithCursor;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [...$this->paginationRules(['due_on' => 'date', 'id' => 'uuid']), ...TaskRules::filters($this->filled('due_from'))];
    }

    public function filters(string $userId): TaskFilters
    {
        $responsable = $this->filled('assignee') ? (string) $this->validated('assignee') : null;

        return new TaskFilters(
            status: $this->filled('status') ? TaskStatus::from((string) $this->validated('status')) : null,
            assigneeUserId: $responsable === 'me' ? $userId : $responsable,
            propertyId: $this->filled('property') ? (string) $this->validated('property') : null,
            unitId: $this->filled('unit') ? (string) $this->validated('unit') : null,
            dueFrom: $this->filled('due_from') ? (string) $this->validated('due_from') : null,
            dueTo: $this->filled('due_to') ? (string) $this->validated('due_to') : null,
            overdue: $this->boolean('overdue'),
            perPage: $this->perPage(),
        );
    }
}
