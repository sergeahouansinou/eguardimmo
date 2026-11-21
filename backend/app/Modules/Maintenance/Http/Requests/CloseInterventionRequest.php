<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CloseInterventionRequest extends FormRequest
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
            'no_invoice_reason' => ['nullable', 'string', 'max:300'],
        ];
    }

    public function lockVersion(): int
    {
        return (int) $this->validated('lock_version');
    }

    public function reason(): ?string
    {
        return $this->filled('no_invoice_reason') ? trim((string) $this->validated('no_invoice_reason')) : null;
    }
}
