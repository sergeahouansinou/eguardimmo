<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Actions;

use App\Modules\Subscriptions\Queries\SubscriptionRecords;
use App\Shared\Approval\ApprovalExecution;
use App\Shared\Approval\ApprovalStale;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class RevokeEntitlementOverride
{
    public function __construct(private SubscriptionRecords $abonnements, private CurrentOrganization $contexte, private RecordAudit $audit) {}

    public function handle(ApprovalExecution $execution): void
    {
        $derogation = $this->abonnements->override($execution->subjectId, true);

        if ($derogation === null || $derogation->revoked_at !== null) {
            throw new ApprovalStale;
        }

        $this->contexte->run($derogation->organization_id, function () use ($derogation, $execution): void {
            $derogation->forceFill(['revoked_at' => now()])->save();

            $this->audit->handle('subscriptions.override.revoked', $execution->decidedByUserId, [
                'feature' => $derogation->feature_key,
                'approval_id' => $execution->approvalId,
            ], $derogation);
        });
    }
}
