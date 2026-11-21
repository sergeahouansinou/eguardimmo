<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Requests;

use App\Modules\Recovery\Data\CaseFilters;
use App\Modules\Recovery\Enums\CaseStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListCasesRequest extends FormRequest
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
            'status' => ['nullable', Rule::enum(CaseStatus::class)],
            'lease' => ['nullable', 'uuid'],
            'debtor' => ['nullable', 'uuid'],
        ];
    }

    public function filters(): CaseFilters
    {
        return new CaseFilters(
            status: $this->filled('status') ? CaseStatus::from((string) $this->validated('status')) : null,
            leaseId: $this->filled('lease') ? (string) $this->validated('lease') : null,
            debtorPartyId: $this->filled('debtor') ? (string) $this->validated('debtor') : null,
            cursor: $this->filled('cursor') ? (string) $this->validated('cursor') : null,
        );
    }
}
