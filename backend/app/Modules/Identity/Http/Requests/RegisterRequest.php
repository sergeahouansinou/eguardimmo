<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Requests;

use App\Modules\Identity\Data\RegistrationData;
use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Models\User;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

final class RegisterRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email:rfc', 'max:255', 'not_regex:/'.preg_quote(User::DELETED_MARKER, '/').'/i'],
            'password' => ['required', 'string', 'max:255', Password::defaults(), 'confirmed'],
            'intended_profile' => [
                'bail',
                'required',
                'string',
                function (string $attribut, mixed $valeur, Closure $echec): void {
                    if ($valeur === 'tenant') {
                        $echec('L\'inscription locataire se fait uniquement sur invitation.');
                    }
                },
                Rule::enum(IntendedProfile::class),
            ],
        ];
    }

    public function toData(): RegistrationData
    {
        return new RegistrationData(
            name: (string) $this->string('name'),
            email: (string) $this->string('email'),
            password: (string) $this->string('password'),
            intendedProfile: IntendedProfile::from((string) $this->string('intended_profile')),
        );
    }
}
