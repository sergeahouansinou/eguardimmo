<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Requests;

use App\Modules\Parties\Data\PartyFilters;
use App\Modules\Parties\Enums\PartyKind;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListPartiesRequest extends FormRequest
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
            ...$this->paginationRules(['display_name' => 'max:255', 'id' => 'uuid']),
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'uuid'],
            'kind' => ['nullable', Rule::enum(PartyKind::class)],
            'status' => ['nullable', Rule::in(['active', 'archived', 'all'])],
        ];
    }

    public function filters(): PartyFilters
    {
        return new PartyFilters(
            search: $this->filled('q') ? trim((string) $this->validated('q')) : null,
            categoryId: $this->filled('category') ? (string) $this->validated('category') : null,
            kind: $this->filled('kind') ? PartyKind::from((string) $this->validated('kind')) : null,
            status: $this->filled('status') ? (string) $this->validated('status') : 'active',
        );
    }
}
