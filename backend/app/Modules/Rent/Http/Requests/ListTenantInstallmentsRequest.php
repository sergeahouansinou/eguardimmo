<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Requests;

use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Queries\TenantInstallments;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListTenantInstallmentsRequest extends FormRequest
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
            'status' => ['nullable', Rule::in(array_map(fn (InstallmentStatus $s): string => $s->value, TenantInstallments::visibleStatuses()))],
        ];
    }

    public function leaseId(): ?string
    {
        return $this->filled('lease') ? (string) $this->validated('lease') : null;
    }

    public function status(): ?InstallmentStatus
    {
        return $this->filled('status') ? InstallmentStatus::from((string) $this->validated('status')) : null;
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
