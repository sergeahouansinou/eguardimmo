<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Requests;

use App\Modules\Planning\Support\ReadsBulkTaskIds;
use Illuminate\Foundation\Http\FormRequest;

final class BulkPostponeTasksRequest extends FormRequest
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
        return [...$this->idRules(), 'due_on' => ['required', 'date_format:Y-m-d', 'after:2000-01-01', 'before:2100-01-01']];
    }

    public function dueOn(): string
    {
        return (string) $this->validated('due_on');
    }
}
