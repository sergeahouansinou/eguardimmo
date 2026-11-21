<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Requests;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Data\NewPushTokenData;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Enums\PushPlatform;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Laravel\Sanctum\PersonalAccessToken;

final class RegisterPushTokenRequest extends FormRequest
{
    private const string CAPACITE_MOBILE = 'mobile';

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
            'token' => ['required', 'string', 'regex:/^[A-Za-z0-9_:.\-]{20,4096}$/'],
            'platform' => ['required', 'string', Rule::enum(PushPlatform::class)],
            'device_name' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * Le jeton d'appareil se lie à la session mobile qui l'enregistre : sans elle, sa révocation ne suivrait pas la déconnexion.
     */
    public function toData(): NewPushTokenData
    {
        /** @var User $compte */
        $compte = $this->user();
        $session = $compte->currentAccessToken();

        if (! $session instanceof PersonalAccessToken || ! $session->can(self::CAPACITE_MOBILE)) {
            throw ErrorCode::MobileSessionRequired->problem();
        }

        $nom = trim((string) $this->validated('device_name'));

        return new NewPushTokenData(
            $compte->id,
            (string) $session->getKey(),
            PushPlatform::from((string) $this->validated('platform')),
            (string) $this->validated('token'),
            $nom === '' ? null : $nom,
        );
    }
}
