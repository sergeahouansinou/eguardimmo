<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SettleLineRequest extends FormRequest
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
            'action' => ['required', Rule::in(['settle_lease', 'settle_invoice', 'bank_charges'])],
            'allocations' => ['required_if:action,settle_lease', 'prohibited_unless:action,settle_lease', 'array', 'min:1', 'max:20'],
            'allocations.*.lease_id' => ['required', 'uuid', 'distinct'],
            'allocations.*.amount' => ['required', 'integer', 'min:1', 'max:100000000000000'],
            'invoice_id' => ['required_if:action,settle_invoice', 'prohibited_unless:action,settle_invoice', 'uuid'],
            'amount' => ['prohibited_unless:action,settle_invoice', 'nullable', 'integer', 'min:1', 'max:100000000000000'],
            'lock_version' => ['required', 'integer', 'min:1'],
        ];
    }
}
