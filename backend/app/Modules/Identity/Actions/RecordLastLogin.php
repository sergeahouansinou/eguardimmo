<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;

final class RecordSuccessfulLogin
{
    public function handle(User $user): void
    {
        User::withoutTimestamps(fn (): bool => $user->forceFill(['previous_login_at' => $user->last_login_at, 'last_login_at' => now()])->saveQuietly());
    }
}
