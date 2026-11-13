<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Data\ReauthenticationData;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class DeleteAccountRequest extends FormRequest
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
            'password' => ['nullable', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:10'],
            'recovery_code' => ['nullable', 'string', 'max:64'],
            'provider' => ['nullable', 'required_with:id_token', Rule::enum(SocialProvider::class)],
            'id_token' => ['nullable', 'required_with:provider', 'string', 'max:8192'],
            'nonce' => ['nullable', 'required_with:id_token', 'string', 'min:16', 'max:255'],
        ];
    }

    public function toData(): ReauthenticationData
    {
        return new ReauthenticationData(
            recentPasswordConfirmation: EnsureRecentReauthentication::confirmedRecently($this, EnsureRecentReauthentication::CLE_MOT_DE_PASSE),
            recentTwoFactorConfirmation: EnsureRecentReauthentication::confirmedRecently($this, EnsureRecentReauthentication::CLE_2FA),
            password: $this->texte('password'),
            code: $this->texte('code'),
            recoveryCode: $this->texte('recovery_code'),
            provider: $this->filled('provider') ? SocialProvider::from((string) $this->string('provider')) : null,
            idToken: $this->texte('id_token'),
            nonce: $this->texte('nonce'),
        );
    }

    private function texte(string $cle): ?string
    {
        return $this->filled($cle) ? (string) $this->string($cle) : null;
    }
}
