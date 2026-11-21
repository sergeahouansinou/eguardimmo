<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ApprovePayoutAccountRequestRequest extends FormRequest
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
            'lock_version' => ['required', 'integer', 'min:1'],
            'iban' => ['required', 'string', 'max:42'],
            'holder_name' => ['required', 'string', 'max:200'],
        ];
    }
}
