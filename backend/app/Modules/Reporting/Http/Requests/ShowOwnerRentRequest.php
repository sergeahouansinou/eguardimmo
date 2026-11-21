<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ShowOwnerRentRequest extends FormRequest
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
        return ['agency' => ['nullable', 'string', 'max:64']];
    }

    public function agency(): ?string
    {
        return $this->filled('agency') ? (string) $this->validated('agency') : null;
    }
}
