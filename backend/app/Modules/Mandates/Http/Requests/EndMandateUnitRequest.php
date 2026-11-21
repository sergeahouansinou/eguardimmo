<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Data\EndMandateUnitData;
use Illuminate\Foundation\Http\FormRequest;

final class EndMandateUnitRequest extends FormRequest
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
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2200-12-31'],
        ];
    }

    public function toData(): EndMandateUnitData
    {
        return new EndMandateUnitData((int) $this->validated('lock_version'), (string) $this->validated('end_date'));
    }
}
