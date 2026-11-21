<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Queries;

use App\Modules\Subscriptions\Enums\SubscriptionStatus;
use App\Modules\Subscriptions\Models\OrganizationEntitlementOverride;
use App\Modules\Subscriptions\Models\Subscription;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Lectures de plateforme qui traversent les organisations : abonnement d'une organisation, essais échus, dérogations.
 */
final class SubscriptionRecords
{
    public function forOrganization(string $organizationId, bool $verrou = false): ?Subscription
    {
        if (! Str::isUuid($organizationId)) {
            return null;
        }

        return AcrossOrganizations::query(Subscription::class)
            ->where('organization_id', strtolower($organizationId))
            ->when($verrou, fn ($q) => $q->lockForUpdate())
            ->first();
    }

    /**
     * @return Collection<string, string> identifiant d'abonnement par organisation
     */
    public function dueTrials(): Collection
    {
        /** @var Collection<string, string> $dus */
        $dus = AcrossOrganizations::query(Subscription::class)
            ->where('status', SubscriptionStatus::Trialing)->where('trial_ends_at', '<=', now())
            ->orderBy('id')->pluck('id', 'organization_id');

        return $dus;
    }

    public function override(string $id, bool $verrou = false): ?OrganizationEntitlementOverride
    {
        if (! Str::isUuid($id)) {
            return null;
        }

        return AcrossOrganizations::query(OrganizationEntitlementOverride::class)
            ->when($verrou, fn ($q) => $q->lockForUpdate())
            ->find(strtolower($id));
    }
}
