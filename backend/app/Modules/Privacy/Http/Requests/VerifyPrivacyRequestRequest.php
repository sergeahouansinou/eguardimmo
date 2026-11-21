<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Requests;

use App\Modules\Privacy\Enums\VerificationMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class VerifyPrivacyRequestRequest extends FormRequest
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
        return ['verification_method' => ['required', 'string', Rule::in([VerificationMethod::KnownChannel->value, VerificationMethod::VideoCall->value, VerificationMethod::DocumentSeen->value])]];
    }

    public function verification(): VerificationMethod
    {
        return VerificationMethod::from((string) $this->validated('verification_method'));
    }
}
