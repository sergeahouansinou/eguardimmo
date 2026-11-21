<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Data\RenewMandateData;
use Illuminate\Foundation\Http\FormRequest;

final class RenewMandateRequest extends FormRequest
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
            'months' => ['required', 'integer', 'between:1,120'],
        ];
    }

    public function toData(): RenewMandateData
    {
        return new RenewMandateData((int) $this->validated('lock_version'), (int) $this->validated('months'));
    }
}
