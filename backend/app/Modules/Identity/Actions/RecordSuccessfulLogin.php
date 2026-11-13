<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AccountLockout;

final readonly class RecordSuccessfulLogin
{
    public function __construct(private AccountLockout $lockout) {}

    public function handle(User $user): void
    {
        $this->lockout->clear($user->email);

        User::withoutTimestamps(fn (): bool => $user->forceFill([
            'previous_login_at' => $user->last_login_at,
            'last_login_at' => now(),
        ])->saveQuietly());
    }
}
