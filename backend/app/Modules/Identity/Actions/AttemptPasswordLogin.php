<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\LoginChannel;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AccountLockout;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use SensitiveParameter;

final readonly class AttemptPasswordLogin
{
    private const HASH_FACTICE = '$2y$12$rpDCcXmU72aSgWHt59Stm.CLyJqnCJwIAVgCyQJsyjqWEO5PSfd7y';

    public function __construct(
        private AccountLockout $lockout,
        private RecordAudit $audit,
    ) {}

    public function handle(string $email, #[SensitiveParameter] string $password, LoginChannel $canal): ?User
    {
        $email = Str::lower(trim($email));
        $this->lockout->ensureNotLocked($email);

        $user = User::query()->where('email', $email)->first();
        $hash = $user?->password;
        $correspond = Hash::check($password, $hash ?? self::HASH_FACTICE);

        if ($user === null || $hash === null || ! $correspond) {
            $this->lockout->recordFailure($email);
            $this->audit->handle('auth.login.failed', null, [
                'channel' => $canal->value,
                'email_hmac' => $this->audit->fingerprint($email),
            ]);

            return null;
        }

        return $user;
    }
}
