<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ListOwnershipsRequest extends FormRequest
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
        return ['at' => ['nullable', 'date_format:Y-m-d']];
    }

    public function at(): ?string
    {
        return $this->filled('at') ? (string) $this->validated('at') : null;
    }
}
