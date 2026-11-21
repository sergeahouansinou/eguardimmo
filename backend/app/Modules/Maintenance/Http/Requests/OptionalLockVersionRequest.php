<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class OptionalLockVersionRequest extends FormRequest
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
            'lock_version' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function lockVersion(): ?int
    {
        return $this->filled('lock_version') ? (int) $this->validated('lock_version') : null;
    }
}
