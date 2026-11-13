<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AccountLockout;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\Hash;
use SensitiveParameter;

final readonly class CheckAccountPassword
{
    public function __construct(
        private AccountLockout $lockout,
        private RecordAudit $audit,
    ) {}

    public function handle(User $user, #[SensitiveParameter] ?string $motDePasse, string $contexte): bool
    {
        if ($motDePasse === null || $motDePasse === '' || $user->password === null) {
            return false;
        }

        $this->lockout->ensureNotLocked($user->email);

        if (Hash::check($motDePasse, $user->password)) {
            return true;
        }

        $this->lockout->recordFailure($user->email);
        $this->audit->handle('auth.reauthentication.failed', $user->id, ['method' => 'password', 'context' => $contexte]);

        return false;
    }
}
