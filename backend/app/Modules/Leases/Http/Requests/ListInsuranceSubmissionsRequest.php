<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Enums\InsuranceSubmissionStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListInsuranceSubmissionsRequest extends FormRequest
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
        return [...$this->paginationRules(['id' => 'uuid']), 'status' => ['sometimes', 'string', Rule::enum(InsuranceSubmissionStatus::class)]];
    }

    public function status(): ?InsuranceSubmissionStatus
    {
        return $this->filled('status') ? InsuranceSubmissionStatus::from((string) $this->validated('status')) : null;
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
