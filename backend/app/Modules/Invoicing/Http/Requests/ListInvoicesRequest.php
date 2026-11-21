<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Http\Requests;

use App\Modules\Invoicing\Data\InvoiceFilters;
use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListInvoicesRequest extends FormRequest
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
            'kind' => ['nullable', Rule::enum(InvoiceKind::class)],
            'status' => ['nullable', Rule::enum(InvoiceStatus::class)],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'search' => ['nullable', 'string', 'min:1', 'max:40'],
            'overdue' => ['nullable', 'boolean'],
            'party' => ['nullable', 'uuid'],
        ];
    }

    public function filters(): InvoiceFilters
    {
        return new InvoiceFilters(
            $this->filled('kind') ? InvoiceKind::from((string) $this->validated('kind')) : null,
            $this->filled('status') ? InvoiceStatus::from((string) $this->validated('status')) : null,
            $this->filled('year') ? (int) $this->validated('year') : null,
            $this->filled('search') ? trim((string) $this->validated('search')) : null,
            $this->boolean('overdue'),
            $this->filled('party') ? (string) $this->validated('party') : null,
            $this->filled('cursor') ? (string) $this->validated('cursor') : null,
        );
    }
}
