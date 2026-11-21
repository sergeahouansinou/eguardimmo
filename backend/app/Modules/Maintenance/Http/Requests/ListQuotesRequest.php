<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Data\QuoteFilters;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListQuotesRequest extends FormRequest
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
            'status' => ['nullable', 'array', 'max:'.count(QuoteStatus::cases())],
            'status.*' => ['string', Rule::enum(QuoteStatus::class)],
            'intervention_id' => ['nullable', 'uuid'],
            'supplier_party_id' => ['nullable', 'uuid'],
        ];
    }

    public function filters(): QuoteFilters
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        /** @var list<string> $statuts */
        $statuts = array_values(array_unique(array_map(strval(...), (array) ($v['status'] ?? []))));

        return new QuoteFilters(
            $statuts,
            isset($v['intervention_id']) ? (string) $v['intervention_id'] : null,
            isset($v['supplier_party_id']) ? (string) $v['supplier_party_id'] : null,
            isset($v['cursor']) ? (string) $v['cursor'] : null,
            $this->perPage(),
        );
    }
}
