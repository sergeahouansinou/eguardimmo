<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

use App\Modules\Identity\Models\User;
use Illuminate\Validation\Rules\Password;

final class AccountPasswordRule
{
    public static function for(User $user): Password
    {
        if (! $user->isActiveOperator()) {
            return Password::default();
        }

        return app()->environment('local', 'testing')
            ? Password::min(8)
            : Password::min(12)->letters()->mixedCase()->numbers()->symbols()->uncompromised();
    }
}
