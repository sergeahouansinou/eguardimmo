<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Requests;

use App\Modules\Messaging\Enums\EmergencyBasis;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class EmergencyAccessRequest extends FormRequest
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
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            'basis' => ['required', 'string', Rule::enum(EmergencyBasis::class)],
        ];
    }

    public function reason(): string
    {
        return trim((string) $this->string('reason'));
    }

    public function basis(): EmergencyBasis
    {
        return EmergencyBasis::from((string) $this->string('basis'));
    }
}
