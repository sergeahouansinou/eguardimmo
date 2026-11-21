<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Requests;

use App\Modules\Investments\Enums\FeeKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreFeeRequest extends FormRequest
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
            'kind' => ['required', Rule::enum(FeeKind::class)],
            'paid_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:1990-01-01', 'before:2100-01-01'],
            'amount' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'document' => ['nullable', 'file', 'max:10240'],
            'currency' => ['prohibited'],
        ];
    }
}
