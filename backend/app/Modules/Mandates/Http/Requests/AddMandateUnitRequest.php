<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Data\AddMandateUnitData;
use Illuminate\Foundation\Http\FormRequest;

final class AddMandateUnitRequest extends FormRequest
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
            'valid_from' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2200-12-31'],
        ];
    }

    public function toData(): AddMandateUnitData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();

        return new AddMandateUnitData((int) $v['lock_version'], (string) $v['unit_id'], isset($v['valid_from']) ? (string) $v['valid_from'] : null);
    }
}
