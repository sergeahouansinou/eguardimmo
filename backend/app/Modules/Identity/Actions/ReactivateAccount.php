<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Shared\Approval\ApprovalExecution;
use App\Shared\Approval\ApprovalStale;
use App\Shared\Audit\RecordAudit;

final readonly class ReactivateAccount
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(ApprovalExecution $execution): void
    {
        $compte = User::withTrashed()->with('operator')->lockForUpdate()->find($execution->subjectId);

        if ($compte === null || $compte->trashed() || $compte->isActiveOperator() || ! $compte->isSuspended()) {
            throw new ApprovalStale;
        }

        $compte->forceFill([
            'suspended_at' => null,
            'suspension_reason' => null,
            'suspended_by_user_id' => null,
            'suspension_reviewed_by_user_id' => null,
            'suspension_reviewed_at' => null,
        ])->save();

        $this->audit->handle('identity.account.reactivated', $execution->decidedByUserId, ['approval_id' => $execution->approvalId], $compte);
    }
}
