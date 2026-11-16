<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use App\Modules\Properties\Data\UnitFilters;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListUnitsRequest extends FormRequest
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
            ...$this->paginationRules(['reference' => 'max:60', 'id' => 'uuid']),
            'q' => ['nullable', 'string', 'max:100'],
            'property' => ['nullable', 'uuid'],
            'unit_type' => ['nullable', 'uuid'],
            'parent' => ['nullable', 'uuid'],
            'root' => ['nullable', 'boolean'],
            'status' => ['nullable', Rule::in(['active', 'archived', 'all'])],
        ];
    }

    public function filters(): UnitFilters
    {
        return new UnitFilters(
            search: $this->filled('q') ? trim((string) $this->validated('q')) : null,
            propertyId: $this->filled('property') ? (string) $this->validated('property') : null,
            unitTypeTermId: $this->filled('unit_type') ? (string) $this->validated('unit_type') : null,
            parentUnitId: $this->filled('parent') ? (string) $this->validated('parent') : null,
            rootOnly: $this->boolean('root'),
            status: $this->filled('status') ? (string) $this->validated('status') : 'active',
        );
    }
}
