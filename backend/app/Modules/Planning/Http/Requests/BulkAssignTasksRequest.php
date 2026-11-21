<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Requests;

use App\Modules\Planning\Support\ReadsBulkTaskIds;
use Illuminate\Foundation\Http\FormRequest;

final class BulkAssignTasksRequest extends FormRequest
{
    use ReadsBulkTaskIds;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [...$this->idRules(), 'assignee_user_id' => ['required', 'uuid']];
    }

    public function assigneeUserId(): string
    {
        return (string) $this->validated('assignee_user_id');
    }
}
