<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class MatchLineRequest extends FormRequest
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
            'line_ids' => ['nullable', 'array', 'max:49'],
            'line_ids.*' => ['uuid', 'distinct'],
            'journal_line_ids' => ['required', 'array', 'min:1', 'max:200'],
            'journal_line_ids.*' => ['uuid', 'distinct'],
            'lock_version' => ['required', 'integer', 'min:1'],
        ];
    }
}
