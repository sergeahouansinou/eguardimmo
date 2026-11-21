<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class StoreMandateEndRequestRequest extends FormRequest
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
        return ['reason' => ['nullable', 'string', 'max:1000']];
    }

    public function reason(): ?string
    {
        $motif = trim((string) $this->validated('reason'));

        return $motif === '' ? null : $motif;
    }
}
