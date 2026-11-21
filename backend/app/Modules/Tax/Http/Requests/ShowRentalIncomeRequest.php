<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ShowRentalIncomeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return ['household_complete' => ['sometimes', 'boolean']];
    }

    public function householdComplete(): bool
    {
        return $this->boolean('household_complete');
    }
}
