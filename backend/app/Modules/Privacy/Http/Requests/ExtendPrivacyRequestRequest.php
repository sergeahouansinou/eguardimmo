<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Requests;

use App\Modules\Privacy\Enums\ExtensionReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ExtendPrivacyRequestRequest extends FormRequest
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
        return ['reason' => ['required', 'string', Rule::enum(ExtensionReason::class)]];
    }

    public function reason(): ExtensionReason
    {
        return ExtensionReason::from((string) $this->validated('reason'));
    }
}
