<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class SocialLinkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'return_to' => ['nullable', 'string', 'max:2048'],
        ];
    }

    public function returnTo(): ?string
    {
        return $this->filled('return_to') ? (string) $this->string('return_to') : null;
    }
}
