<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\TwoFactorResetNotification;
use App\Shared\Approval\ApprovalExecution;
use App\Shared\Approval\ApprovalStale;
use App\Shared\Audit\RecordAudit;

final readonly class ResetAccountTwoFactor
{
    public function __construct(private RevokeUserCredentials $revocation, private RecordAudit $audit) {}

    public function handle(ApprovalExecution $execution): void
    {
        $compte = User::withTrashed()->with('operator')->lockForUpdate()->find($execution->subjectId);

        if ($compte === null || $compte->trashed() || $compte->isActiveOperator() || ! $compte->hasConfirmedTwoFactor()) {
            throw new ApprovalStale;
        }

        $compte->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        $this->revocation->handle($compte, 'two_factor_reset');
        $this->audit->handle('identity.account.two_factor_reset', $execution->decidedByUserId, [
            'approval_id' => $execution->approvalId,
            'verification_method' => (string) ($execution->payload['verification_method'] ?? ''),
        ], $compte);

        $compte->notify(new TwoFactorResetNotification);
    }
}
