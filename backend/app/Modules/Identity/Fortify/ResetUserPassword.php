<?php

declare(strict_types=1);

namespace App\Modules\Identity\Fortify;

use App\Modules\Identity\Actions\ResetPassword;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Contracts\ResetsUserPasswords;

final readonly class ResetUserPassword implements ResetsUserPasswords
{
    public function __construct(private ResetPassword $action) {}

    /**
     * @param  User  $user
     * @param  array<string, mixed>  $input
     */
    public function reset($user, array $input): void
    {
        $valide = Validator::make($input, [
            'password' => ['required', 'string', 'max:255', Password::defaults(), 'confirmed'],
        ])->validate();

        $this->action->handle($user, (string) $valide['password']);
    }
}
