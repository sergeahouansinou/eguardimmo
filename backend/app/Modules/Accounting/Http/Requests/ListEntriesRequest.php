<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Requests;

use App\Modules\Accounting\Data\EntryFilters;
use App\Modules\Accounting\Enums\Journal;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListEntriesRequest extends FormRequest
{
    use PaginatesWithCursor;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...$this->paginationRules(['entry_date' => 'date', 'id' => 'uuid']),
            'journal' => ['nullable', Rule::enum(Journal::class)],
            'lease' => ['nullable', 'uuid'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }

    public function toData(): EntryFilters
    {
        return new EntryFilters(
            journal: $this->filled('journal') ? Journal::from((string) $this->string('journal')) : null,
            leaseId: $this->filled('lease') ? strtolower((string) $this->string('lease')) : null,
            from: $this->filled('from') ? $this->date('from')?->toImmutable() : null,
            to: $this->filled('to') ? $this->date('to')?->toImmutable() : null,
            perPage: $this->perPage(),
        );
    }
}
