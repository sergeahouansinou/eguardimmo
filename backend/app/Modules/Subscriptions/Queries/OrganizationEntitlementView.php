<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Queries;

use App\Modules\Subscriptions\Enums\ErrorCode;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Models\OrganizationEntitlementOverride;
use App\Modules\Subscriptions\Models\Subscription;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Support\Str;

final readonly class OrganizationEntitlementView
{
    public function __construct(private EffectiveEntitlements $droits) {}

    /**
     * @return array<string, mixed>
     */
    public function of(string $organizationId): array
    {
        $id = strtolower($organizationId);
        $abonnement = Str::isUuid($id) ? AcrossOrganizations::query(Subscription::class)->with('planVersion.plan')->where('organization_id', $id)->first() : null;

        if ($abonnement === null) {
            throw ErrorCode::SubscriptionNotFound->problem();
        }

        $droits = [];
        foreach ($this->droits->of($id) ?? [] as $cle => $droit) {
            $fonction = Feature::from($cle);
            $droits[] = [
                'feature' => $cle, 'label' => $fonction->label(), 'group' => $fonction->group(), 'kind' => $fonction->isQuota() ? 'quota' : 'function',
                'enabled' => $droit->enabled, 'limit' => $droit->limit, 'source' => $droit->source,
            ];
        }

        $derogations = AcrossOrganizations::query(OrganizationEntitlementOverride::class)->where('organization_id', $id)->orderByDesc('created_at')->get()
            ->map(fn (OrganizationEntitlementOverride $d): array => [
                'id' => $d->id, 'feature' => $d->feature_key, 'enabled' => $d->enabled, 'limit' => $d->limit_value,
                'starts_at' => $d->starts_at->toIso8601String(), 'ends_at' => $d->ends_at->toIso8601String(),
                'reason_code' => $d->reason_code, 'revoked_at' => $d->revoked_at?->toIso8601String(),
            ])->all();

        return [
            'organization_id' => $id,
            'subscription' => [
                'plan' => $abonnement->planVersion->plan->code,
                'plan_version' => $abonnement->planVersion->version,
                'status' => $abonnement->status->value,
                'trial_ends_at' => $abonnement->trial_ends_at?->toIso8601String(),
                'currency' => $abonnement->currency,
            ],
            'entitlements' => $droits,
            'overrides' => $derogations,
        ];
    }
}
