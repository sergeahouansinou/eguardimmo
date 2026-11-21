<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class VoidLoanRequest extends FormRequest
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
        return ['reason' => ['required', 'string', 'min:3', 'max:255'], 'lock_version' => ['required', 'integer', 'min:1']];
    }
}
