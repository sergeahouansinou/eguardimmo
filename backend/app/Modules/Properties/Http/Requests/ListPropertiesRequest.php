<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use App\Modules\Properties\Data\PropertyFilters;
use App\Modules\Properties\Enums\PropertyType;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListPropertiesRequest extends FormRequest
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
            ...$this->paginationRules(['name' => 'max:200', 'id' => 'uuid']),
            'q' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::enum(PropertyType::class)],
            'status' => ['nullable', Rule::in(['active', 'archived', 'all'])],
        ];
    }

    public function filters(): PropertyFilters
    {
        return new PropertyFilters(
            search: $this->filled('q') ? trim((string) $this->validated('q')) : null,
            type: $this->filled('type') ? PropertyType::from((string) $this->validated('type')) : null,
            status: $this->filled('status') ? (string) $this->validated('status') : 'active',
        );
    }
}
