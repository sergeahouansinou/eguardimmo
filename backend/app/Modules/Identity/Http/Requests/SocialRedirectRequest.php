<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Enums\IntendedProfile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SocialRedirectRequest extends FormRequest
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
            'intent' => ['required', Rule::in(['login', 'register'])],
            'profile' => ['required_if:intent,register', 'nullable', Rule::enum(IntendedProfile::class)],
            'return_to' => ['nullable', 'string', 'max:2048'],
        ];
    }

    public function profile(): ?IntendedProfile
    {
        return $this->input('intent') === 'register' ? IntendedProfile::from((string) $this->string('profile')) : null;
    }

    public function returnTo(): ?string
    {
        return $this->filled('return_to') ? (string) $this->string('return_to') : null;
    }
}
