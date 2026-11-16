<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use App\Modules\Leases\Data\CancelLeaseData;
use Illuminate\Foundation\Http\FormRequest;

final class CancelLeaseRequest extends FormRequest
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
        ];
    }

    public function toData(): CancelLeaseData
    {
        return new CancelLeaseData((int) $this->validated('lock_version'));
    }
}
