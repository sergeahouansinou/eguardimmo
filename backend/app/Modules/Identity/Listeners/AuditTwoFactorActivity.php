<?php

declare(strict_types=1);

namespace App\Modules\Identity\Listeners;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AccountLockout;
use App\Shared\Audit\RecordAudit;
use Laravel\Fortify\Events\RecoveryCodeReplaced;
use Laravel\Fortify\Events\RecoveryCodesGenerated;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;

final readonly class AuditTwoFactorActivity
{
    public function __construct(
        private RecordAudit $audit,
        private AccountLockout $lockout,
    ) {}

    public function handle(RecoveryCodeReplaced|RecoveryCodesGenerated|TwoFactorAuthenticationFailed $evenement): void
    {
        $user = data_get($evenement, 'user');

        if (! $user instanceof User) {
            return;
        }

        $action = match (true) {
            $evenement instanceof RecoveryCodeReplaced => 'auth.two_factor.recovery_used',
            $evenement instanceof RecoveryCodesGenerated => 'auth.two_factor.recovery_regenerated',
            default => 'auth.two_factor.failed',
        };

        if ($evenement instanceof TwoFactorAuthenticationFailed) {
            $this->lockout->recordFailure($user->email);
        }

        $this->audit->handle($action, $user->id);
    }
}
