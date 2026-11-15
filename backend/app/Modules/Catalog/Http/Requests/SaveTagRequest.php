<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class SaveTagRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:1', 'max:60', 'regex:/\p{L}|\p{N}/u'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ];
    }

    public function name(): string
    {
        return (string) $this->validated('name');
    }

    public function color(): ?string
    {
        return $this->filled('color') ? strtolower((string) $this->validated('color')) : null;
    }
}
