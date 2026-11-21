<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Actions;

use App\Modules\Subscriptions\Models\OrganizationEntitlementOverride;
use App\Modules\Subscriptions\Queries\SubscriptionRecords;
use App\Shared\Approval\ApprovalExecution;
use App\Shared\Approval\ApprovalStale;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class GrantEntitlementOverride
{
    public function __construct(private SubscriptionRecords $abonnements, private CurrentOrganization $contexte, private RecordAudit $audit) {}

    /**
     * Exécuteur de `subscriptions.override.grant` : dérogation datée, toujours bornée dans le temps.
     */
    public function handle(ApprovalExecution $execution): void
    {
        $abonnement = $this->abonnements->forOrganization($execution->subjectId, true);

        if ($abonnement === null) {
            throw new ApprovalStale;
        }

        $charge = $execution->payload;
        $limite = array_key_exists('limit_value', $charge) && $charge['limit_value'] !== null ? (int) $charge['limit_value'] : null;
        $fin = CarbonImmutable::parse((string) $charge['ends_at'])->endOfDay();

        $this->contexte->run($abonnement->organization_id, function () use ($charge, $limite, $fin, $execution): void {
            $derogation = OrganizationEntitlementOverride::query()->create([
                'feature_key' => (string) $charge['feature'],
                'enabled' => filter_var($charge['enabled'], FILTER_VALIDATE_BOOLEAN),
                'limit_value' => $limite,
                'starts_at' => now(),
                'ends_at' => $fin,
                'reason_code' => (string) $charge['reason_code'],
                'approval_id' => $execution->approvalId,
                'granted_by_user_id' => $execution->decidedByUserId,
            ]);

            $this->audit->handle('subscriptions.override.granted', $execution->decidedByUserId, [
                'feature' => $derogation->feature_key,
                'enabled' => $derogation->enabled,
                'limit_value' => $derogation->limit_value,
                'ends_at' => $fin->toDateString(),
                'reason_code' => $derogation->reason_code,
                'approval_id' => $execution->approvalId,
            ], $derogation);
        });
    }
}
