<?php

declare(strict_types=1);

namespace App\Modules\Identity\Fortify;

use App\Modules\Identity\Actions\UpdatePassword;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Support\AccountPasswordRule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\UpdatesUserPasswords;

final readonly class UpdateUserPassword implements UpdatesUserPasswords
{
    public function __construct(
        private UpdatePassword $action,
        private Request $request,
    ) {}

    /**
     * @param  User  $user
     * @param  array<string, mixed>  $input
     */
    public function update($user, array $input): void
    {
        $valide = Validator::make($input, [
            'current_password' => ['required', 'string', 'current_password:web'],
            'password' => ['required', 'string', 'max:255', AccountPasswordRule::for($user), 'confirmed'],
        ], [
            'current_password.current_password' => 'Le mot de passe actuel est incorrect.',
        ])->validateWithBag('updatePassword');

        $session = $this->request->hasSession() ? $this->request->session()->getId() : null;

        $this->action->handle($user, (string) $valide['password'], $session);
    }
}
