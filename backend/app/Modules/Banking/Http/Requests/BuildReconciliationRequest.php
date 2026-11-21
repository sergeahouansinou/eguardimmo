<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class BuildReconciliationRequest extends FormRequest
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
            'bank_account_id' => ['required', 'uuid'],
            'month' => ['required', 'date_format:Y-m'],
            'bank_balance' => ['nullable', 'integer', 'min:-100000000000000', 'max:100000000000000'],
            'proof' => ['nullable', 'file', 'max:10240'],
        ];
    }
}
