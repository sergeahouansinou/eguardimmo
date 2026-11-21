<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Requests;

use App\Modules\Rent\Enums\PaymentStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListPaymentsRequest extends FormRequest
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
            'status' => ['nullable', Rule::enum(PaymentStatus::class)],
        ];
    }

    public function leaseId(): ?string
    {
        return $this->filled('lease') ? (string) $this->validated('lease') : null;
    }

    public function status(): ?PaymentStatus
    {
        return $this->filled('status') ? PaymentStatus::from((string) $this->validated('status')) : null;
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
