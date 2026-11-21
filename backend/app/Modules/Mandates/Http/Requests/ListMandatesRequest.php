<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Data\MandateFilters;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListMandatesRequest extends FormRequest
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
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::enum(MandateStatus::class)],
            'mandant' => ['nullable', 'uuid'],
            'unit' => ['nullable', 'uuid'],
            'archived' => ['nullable', 'boolean'],
            'end_request' => ['nullable', Rule::in(['pending'])],
        ];
    }

    public function filters(): MandateFilters
    {
        return new MandateFilters(
            status: $this->filled('status') ? MandateStatus::from((string) $this->validated('status')) : null,
            mandantPartyId: $this->filled('mandant') ? (string) $this->validated('mandant') : null,
            unitId: $this->filled('unit') ? (string) $this->validated('unit') : null,
            archived: $this->boolean('archived'),
            endRequestPending: $this->validated('end_request') === 'pending',
            search: $this->filled('q') ? trim((string) $this->validated('q')) : null,
            cursor: $this->filled('cursor') ? (string) $this->validated('cursor') : null,
        );
    }
}
