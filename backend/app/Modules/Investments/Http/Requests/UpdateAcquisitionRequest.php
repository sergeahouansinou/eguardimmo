<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class UpdateAcquisitionRequest extends FormRequest
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
            'acquired_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:1900-01-01', 'before:2100-01-01'],
            'price' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'acquisition_costs' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'agency_fees' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'initial_works' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'lock_version' => ['required', 'integer', 'min:1'],
            'currency' => ['prohibited'],
            'property_id' => ['prohibited'],
            'unit_id' => ['prohibited'],
        ];
    }
}
