<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListBookLinesRequest extends FormRequest
{
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
            'account_id' => ['required', 'uuid'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'amount' => ['nullable', 'integer', 'min:1', 'max:100000000000000'],
            'side' => ['nullable', Rule::in(['debit', 'credit'])],
            'cursor' => ['nullable', 'string', 'max:200', 'regex:/^[A-Za-z0-9_=-]+$/'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ];
    }
}
