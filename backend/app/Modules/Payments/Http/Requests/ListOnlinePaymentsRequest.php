<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Requests;

use App\Modules\Payments\Enums\OnlinePaymentStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListOnlinePaymentsRequest extends FormRequest
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
            'status' => ['sometimes', 'string', Rule::enum(OnlinePaymentStatus::class)],
            'lease_id' => ['sometimes', 'uuid'],
        ];
    }

    public function status(): ?OnlinePaymentStatus
    {
        return $this->filled('status') ? OnlinePaymentStatus::from((string) $this->validated('status')) : null;
    }

    public function leaseId(): ?string
    {
        return $this->filled('lease_id') ? (string) $this->validated('lease_id') : null;
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
