<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Events\OrganizationReactivated;
use App\Modules\Organizations\Models\Organization;
use App\Shared\Approval\ApprovalExecution;
use App\Shared\Approval\ApprovalStale;
use App\Shared\Audit\RecordAudit;

final readonly class ReactivateOrganization
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(ApprovalExecution $execution): void
    {
        $organisation = Organization::query()->lockForUpdate()->find($execution->subjectId);

        if ($organisation === null || ! $organisation->isSuspended()) {
            throw new ApprovalStale;
        }

        $organisation->forceFill(['suspended_at' => null, 'suspension_reason' => null])->save();

        $this->audit->handle('organizations.organization.reactivated', $execution->decidedByUserId, ['approval_id' => $execution->approvalId], $organisation);

        OrganizationReactivated::dispatch($organisation->id, $execution->approvalId);
    }
}
