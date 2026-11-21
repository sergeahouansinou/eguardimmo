<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Requests;

use App\Modules\Investments\Data\NewAcquisitionData;
use Illuminate\Foundation\Http\FormRequest;

final class StoreAcquisitionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * La devise est celle de l'organisation : la fixer ici est refusé.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'property_id' => ['required', 'uuid'],
            'unit_id' => ['nullable', 'uuid'],
            'acquired_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:1900-01-01', 'before:2100-01-01'],
            'price' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'acquisition_costs' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'agency_fees' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'initial_works' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'document' => ['nullable', 'file', 'max:10240'],
            'currency' => ['prohibited'],
            'lock_version' => ['prohibited'],
        ];
    }

    public function toData(string $idempotencyKey): NewAcquisitionData
    {
        $v = $this->validated();

        return new NewAcquisitionData(
            (string) $v['property_id'], isset($v['unit_id']) ? (string) $v['unit_id'] : null, (string) $v['acquired_on'], (int) $v['price'],
            (int) ($v['acquisition_costs'] ?? 0), (int) ($v['agency_fees'] ?? 0), (int) ($v['initial_works'] ?? 0), $this->file('document'), $idempotencyKey,
        );
    }
}
