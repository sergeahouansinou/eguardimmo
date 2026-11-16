<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Enums\LeasePhase;
use App\Modules\Leases\Queries\LeaseFilters;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListLeasesRequest extends FormRequest
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
            ...$this->paginationRules(['starts_on' => 'date_format:Y-m-d,Y-m-d H:i:s', 'id' => 'uuid']),
            'q' => ['nullable', 'string', 'max:100'],
            'phase' => ['nullable', Rule::enum(LeasePhase::class)],
            'unit' => ['nullable', 'uuid'],
            'party' => ['nullable', 'uuid'],
            'archived' => ['nullable', 'boolean'],
        ];
    }

    public function filters(): LeaseFilters
    {
        return new LeaseFilters(
            phase: $this->filled('phase') ? LeasePhase::from((string) $this->validated('phase')) : null,
            unitId: $this->filled('unit') ? (string) $this->validated('unit') : null,
            partyId: $this->filled('party') ? (string) $this->validated('party') : null,
            archived: $this->boolean('archived'),
            search: $this->filled('q') ? trim((string) $this->validated('q')) : null,
            cursor: $this->filled('cursor') ? (string) $this->validated('cursor') : null,
        );
    }
}
