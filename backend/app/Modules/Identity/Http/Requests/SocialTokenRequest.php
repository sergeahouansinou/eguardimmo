<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Data\SocialIntent;
use App\Modules\Identity\Enums\IntendedProfile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SocialTokenRequest extends FormRequest
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
            'id_token' => ['required', 'string', 'max:8192'],
            'nonce' => ['required', 'string', 'min:16', 'max:255'],
            'authorization_code' => ['nullable', 'string', 'max:2048'],
            'device_name' => MobileTokenRequest::REGLE_APPAREIL,
            'intent' => ['required', Rule::in(['login', 'register'])],
            'profile' => ['required_if:intent,register', 'nullable', Rule::enum(IntendedProfile::class)],
            'name' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function intent(): SocialIntent
    {
        return $this->input('intent') === 'register'
            ? SocialIntent::register(IntendedProfile::from((string) $this->string('profile')))
            : SocialIntent::login();
    }

    public function authorizationCode(): ?string
    {
        return $this->filled('authorization_code') ? (string) $this->string('authorization_code') : null;
    }

    public function fullName(): ?string
    {
        return $this->filled('name') ? (string) $this->string('name') : null;
    }
}
