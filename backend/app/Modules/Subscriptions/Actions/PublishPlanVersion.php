<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Actions;

use App\Modules\Subscriptions\Enums\PlanVersionStatus;
use App\Modules\Subscriptions\Models\PlanVersion;
use App\Modules\Subscriptions\Support\PlanVersionDigest;
use App\Modules\Subscriptions\Support\PlanVersionRules;
use App\Shared\Approval\ApprovalExecution;
use App\Shared\Approval\ApprovalStale;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;

final readonly class PublishPlanVersion
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Exécuteur de `subscriptions.plan_version.publish` : la version précédente est archivée, les abonnements existants gardent la leur.
     */
    public function handle(ApprovalExecution $execution): void
    {
        $version = PlanVersion::query()->with(['entitlements', 'prices'])->lockForUpdate()->find($execution->subjectId);

        if ($version === null || ! $version->isDraft()) {
            throw new ApprovalStale;
        }

        $attendue = $execution->payload['content_sha256'] ?? null;

        if (! is_string($attendue) || ! hash_equals($attendue, PlanVersionDigest::of($version))) {
            throw new ApprovalStale;
        }

        try {
            PlanVersionRules::assertPublishable($version);
        } catch (ApiProblem) {
            throw new ApprovalStale;
        }

        $precedentes = PlanVersion::query()->where('plan_id', $version->plan_id)->where('status', PlanVersionStatus::Published)->lockForUpdate()->get();

        foreach ($precedentes as $ancienne) {
            $ancienne->forceFill(['status' => PlanVersionStatus::Archived, 'archived_at' => now()])->save();
            $this->audit->handle('subscriptions.plan_version.archived', $execution->decidedByUserId, ['version' => $ancienne->version, 'approval_id' => $execution->approvalId], $ancienne);
        }

        $version->forceFill(['status' => PlanVersionStatus::Published, 'published_at' => now()])->save();
        $this->audit->handle('subscriptions.plan_version.published', $execution->decidedByUserId, ['version' => $version->version, 'approval_id' => $execution->approvalId], $version);
    }
}
