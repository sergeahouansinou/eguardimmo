<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ReasonRequest extends FormRequest
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
        return ['reason' => ['required', 'string', 'min:3', 'max:255']];
    }

    public function reason(): string
    {
        return trim((string) $this->validated('reason'));
    }
}
