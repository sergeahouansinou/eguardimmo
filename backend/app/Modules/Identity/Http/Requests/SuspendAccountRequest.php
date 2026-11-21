<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Enums\SuspensionReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SuspendAccountRequest extends FormRequest
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
            'reason' => ['required', 'string', Rule::enum(SuspensionReason::class)],
        ];
    }

    public function reason(): SuspensionReason
    {
        return SuspensionReason::from((string) $this->validated('reason'));
    }
}
