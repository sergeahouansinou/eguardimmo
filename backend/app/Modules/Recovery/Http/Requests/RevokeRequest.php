<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class RevokeRequest extends FormRequest
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
        return ['reason' => ['nullable', 'string', 'max:255']];
    }

    public function reason(): ?string
    {
        return $this->filled('reason') ? trim((string) $this->validated('reason')) : null;
    }
}
