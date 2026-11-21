<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\LineState;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListLinesRequest extends FormRequest
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
            ...$this->paginationRules(['booking_date' => 'date', 'id' => 'uuid']),
            'account_id' => ['nullable', 'uuid'],
            'statement_id' => ['nullable', 'uuid'],
            'state' => ['nullable', Rule::enum(LineState::class)],
            'direction' => ['nullable', Rule::enum(Direction::class)],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'amount' => ['nullable', 'integer', 'min:1', 'max:100000000000000'],
        ];
    }
}
