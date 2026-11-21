<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Requests;

use App\Modules\Privacy\Enums\RefusalReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class RefusePrivacyRequestRequest extends FormRequest
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
        return ['reason' => ['required', 'string', Rule::enum(RefusalReason::class)]];
    }

    public function reason(): RefusalReason
    {
        return RefusalReason::from((string) $this->validated('reason'));
    }
}
