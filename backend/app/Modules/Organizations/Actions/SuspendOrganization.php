<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Enums\SuspensionReason;
use App\Modules\Organizations\Events\OrganizationSuspended;
use App\Modules\Organizations\Models\Organization;
use App\Shared\Approval\ApprovalExecution;
use App\Shared\Approval\ApprovalStale;
use App\Shared\Audit\RecordAudit;

final readonly class SuspendOrganization
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(ApprovalExecution $execution): void
    {
        $motif = is_string($execution->payload['reason_code'] ?? null) ? SuspensionReason::tryFrom($execution->payload['reason_code']) : null;
        $organisation = Organization::query()->lockForUpdate()->find($execution->subjectId);

        if ($motif === null || $organisation === null || $organisation->isSuspended()) {
            throw new ApprovalStale;
        }

        $organisation->forceFill(['suspended_at' => now(), 'suspension_reason' => $motif])->save();

        $this->audit->handle('organizations.organization.suspended', $execution->decidedByUserId, [
            'approval_id' => $execution->approvalId,
            'reason_code' => $motif->value,
        ], $organisation);

        OrganizationSuspended::dispatch($organisation->id, $execution->approvalId);
    }
}
