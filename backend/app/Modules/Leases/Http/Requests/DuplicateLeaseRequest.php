<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\DuplicateLeaseData;
use Illuminate\Foundation\Http\FormRequest;

final class DuplicateLeaseRequest extends FormRequest
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
            'starts_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
        ];
    }

    public function toData(): DuplicateLeaseData
    {
        return new DuplicateLeaseData((string) $this->validated('starts_on'));
    }
}
