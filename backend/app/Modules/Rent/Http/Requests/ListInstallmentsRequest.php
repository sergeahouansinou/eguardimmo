<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Requests;

use App\Modules\Rent\Data\InstallmentFilters;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListInstallmentsRequest extends FormRequest
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
            'lease' => ['nullable', 'uuid'],
            'status' => ['nullable', Rule::enum(InstallmentStatus::class)],
            'due_from' => ['nullable', 'date_format:Y-m-d'],
            'due_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:due_from'],
            'overdue' => ['nullable', 'boolean'],
        ];
    }

    public function filters(): InstallmentFilters
    {
        return new InstallmentFilters(
            leaseId: $this->filled('lease') ? (string) $this->validated('lease') : null,
            status: $this->filled('status') ? InstallmentStatus::from((string) $this->validated('status')) : null,
            dueFrom: $this->filled('due_from') ? (string) $this->validated('due_from') : null,
            dueTo: $this->filled('due_to') ? (string) $this->validated('due_to') : null,
            overdue: $this->boolean('overdue'),
            cursor: $this->filled('cursor') ? (string) $this->validated('cursor') : null,
        );
    }
}
