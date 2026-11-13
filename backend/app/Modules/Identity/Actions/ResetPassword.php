<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\PasswordChangedNotification;
use App\Shared\Audit\RecordAudit;
use SensitiveParameter;

final readonly class ResetPassword
{
    public function __construct(
        private RevokeUserCredentials $revoke,
        private RecordAudit $audit,
    ) {}

    public function handle(User $user, #[SensitiveParameter] string $password): void
    {
        $user->forceFill(['password' => $password])->save();
        $this->revoke->handle($user, 'password_reset');
        $this->audit->handle('auth.password.reset', $user->id);
        $user->notify(new PasswordChangedNotification);
    }
}
