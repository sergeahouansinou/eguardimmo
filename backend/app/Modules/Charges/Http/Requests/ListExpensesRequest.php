<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use App\Modules\Charges\Enums\ExpenseSettlement;
use App\Modules\Charges\Enums\ExpenseStatus;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListExpensesRequest extends FormRequest
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
            'property_id' => ['nullable', 'uuid'],
            'unit_id' => ['nullable', 'uuid'],
            'status' => ['nullable', Rule::enum(ExpenseStatus::class)],
            'settlement' => ['nullable', Rule::enum(ExpenseSettlement::class)],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after:from'],
        ];
    }

    /**
     * @return array{property_id: string|null, unit_id: string|null, status: string|null, settlement: string|null, from: string|null, to: string|null}
     */
    public function filters(): array
    {
        $v = $this->validated();

        return [
            'property_id' => isset($v['property_id']) ? (string) $v['property_id'] : null,
            'unit_id' => isset($v['unit_id']) ? (string) $v['unit_id'] : null,
            'status' => isset($v['status']) ? (string) $v['status'] : null,
            'settlement' => isset($v['settlement']) ? (string) $v['settlement'] : null,
            'from' => isset($v['from']) ? (string) $v['from'] : null,
            'to' => isset($v['to']) ? (string) $v['to'] : null,
        ];
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
