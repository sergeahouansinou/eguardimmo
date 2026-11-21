<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Enums\SupplierStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListSuppliersRequest extends FormRequest
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
            'status' => ['nullable', Rule::enum(SupplierStatus::class)],
        ];
    }

    public function status(): ?SupplierStatus
    {
        return $this->filled('status') ? SupplierStatus::from((string) $this->validated('status')) : null;
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
