<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\NewLeaseUnitChangeData;
use Illuminate\Foundation\Http\FormRequest;

final class AddLeaseUnitRequest extends FormRequest
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
            'unit_id' => ['required', 'uuid'],
            'is_main' => ['sometimes', 'boolean'],
            'valid_from' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
        ];
    }

    public function toData(): NewLeaseUnitChangeData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new NewLeaseUnitChangeData(
            lockVersion: (int) $v['lock_version'],
            unitId: (string) $v['unit_id'],
            isMain: (bool) ($v['is_main'] ?? false),
            validFrom: (string) $v['valid_from'],
        );
    }
}
