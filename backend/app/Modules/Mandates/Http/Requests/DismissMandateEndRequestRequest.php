<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class DismissMandateEndRequestRequest extends FormRequest
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
        return ['note' => ['nullable', 'string', 'max:500']];
    }

    public function note(): ?string
    {
        $note = trim((string) $this->validated('note'));

        return $note === '' ? null : $note;
    }
}
