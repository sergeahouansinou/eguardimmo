<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Requests;

use App\Modules\Investments\Enums\LoanStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListLoansRequest extends FormRequest
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
        return ['property_id' => ['nullable', 'uuid'], 'status' => ['nullable', Rule::enum(LoanStatus::class)]];
    }
}
