<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\InterventionFilters;
use App\Modules\Maintenance\Enums\InterventionOrigin;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\Priority;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListInterventionsRequest extends FormRequest
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
        return [
            ...$this->paginationRules(['id' => 'uuid']),
            'status' => ['nullable', Rule::enum(InterventionStatus::class)],
            'priority' => ['nullable', Rule::enum(Priority::class)],
            'unit_id' => ['nullable', 'uuid'],
            'supplier_party_id' => ['nullable', 'uuid'],
            'origin' => ['nullable', Rule::enum(InterventionOrigin::class)],
            'overdue' => ['nullable', 'boolean'],
            'search' => ['nullable', 'string', 'max:80'],
            'due_from' => ['nullable', 'date_format:Y-m-d', 'after:2000-01-01', 'before:2100-01-01'],
            'due_to' => ['nullable', 'date_format:Y-m-d', 'after:2000-01-01', 'before:2100-01-02', ...($this->filled('due_from') ? ['after:due_from'] : [])],
        ];
    }

    public function filters(): InterventionFilters
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new InterventionFilters(
            isset($v['status']) ? (string) $v['status'] : null,
            isset($v['priority']) ? (string) $v['priority'] : null,
            isset($v['unit_id']) ? (string) $v['unit_id'] : null,
            isset($v['supplier_party_id']) ? (string) $v['supplier_party_id'] : null,
            isset($v['origin']) ? (string) $v['origin'] : null,
            $this->boolean('overdue'),
            isset($v['search']) ? trim((string) $v['search']) : null,
            isset($v['due_from']) ? (string) $v['due_from'] : null,
            isset($v['due_to']) ? (string) $v['due_to'] : null,
            isset($v['cursor']) ? (string) $v['cursor'] : null,
            $this->perPage(),
        );
    }
}
