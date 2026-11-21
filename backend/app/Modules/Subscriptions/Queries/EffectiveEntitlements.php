<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Queries;

use App\Modules\Subscriptions\Data\EntitlementData;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Enums\SubscriptionStatus;
use App\Modules\Subscriptions\Models\OrganizationEntitlementOverride;
use App\Modules\Subscriptions\Models\PlanEntitlement;
use App\Modules\Subscriptions\Models\Subscription;
use App\Shared\Tenancy\AcrossOrganizations;

/**
 * Droits effectifs d'une organisation : essai complet, sinon version de plan souscrite, puis dérogations vivantes.
 */
final class EffectiveEntitlements
{
    /**
     * @return array<string, EntitlementData>|null null tant que l'organisation n'a aucun abonnement
     */
    public function of(string $organizationId, bool $verrou = false): ?array
    {
        $abonnement = AcrossOrganizations::query(Subscription::class)->where('organization_id', $organizationId)->when($verrou, fn ($q) => $q->lockForUpdate())->first();

        if ($abonnement === null) {
            return null;
        }

        $droits = $this->base($abonnement);

        // Les colonnes portent les microsecondes : sans elles, une borne posée à la même seconde se comparerait en texte à l'envers.
        $maintenant = now()->format('Y-m-d H:i:s.u');

        $derogations = AcrossOrganizations::query(OrganizationEntitlementOverride::class)
            ->where('organization_id', $organizationId)
            ->whereNull('revoked_at')
            ->where('starts_at', '<=', $maintenant)
            ->where('ends_at', '>', $maintenant)
            ->orderBy('created_at')
            ->get();

        foreach ($derogations as $derogation) {
            if (Feature::tryFrom($derogation->feature_key) !== null) {
                $droits[$derogation->feature_key] = new EntitlementData($derogation->feature_key, $derogation->enabled, $derogation->limit_value, 'override');
            }
        }

        return $droits;
    }

    /**
     * @return array<string, EntitlementData>
     */
    private function base(Subscription $abonnement): array
    {
        $enEssai = $abonnement->status === SubscriptionStatus::Trialing && $abonnement->trial_ends_at !== null && $abonnement->trial_ends_at->isFuture();

        if ($enEssai) {
            $droits = [];
            foreach (Feature::cases() as $fonction) {
                $droits[$fonction->value] = new EntitlementData($fonction->value, true, null, 'trial');
            }

            return $droits;
        }

        $droits = [];
        foreach (Feature::cases() as $fonction) {
            $droits[$fonction->value] = new EntitlementData($fonction->value, false, null, 'plan');
        }

        foreach (PlanEntitlement::query()->where('plan_version_id', $abonnement->plan_version_id)->get() as $ligne) {
            if (isset($droits[$ligne->feature_key])) {
                $droits[$ligne->feature_key] = new EntitlementData($ligne->feature_key, $ligne->enabled, $ligne->limit_value, 'plan');
            }
        }

        return $droits;
    }
}
