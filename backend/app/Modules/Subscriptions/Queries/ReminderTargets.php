<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Queries;

use App\Modules\Subscriptions\Enums\SubscriptionStatus;
use App\Modules\Subscriptions\Models\Subscription;
use App\Shared\Reminders\ReminderHit;
use App\Shared\Reminders\ReminderWindow;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

final class ReminderTargets
{
    /**
     * Essais qui se terminent dans la fenêtre (ADR 0042) ; départ : la fin de l'essai.
     *
     * @return iterable<ReminderHit>
     */
    public function endingTrials(ReminderWindow $fenetre): iterable
    {
        return AcrossOrganizations::query(Subscription::class)
            ->where('status', SubscriptionStatus::Trialing->value)
            ->where('trial_ends_at', '>=', $fenetre->from->format('Y-m-d H:i:s.u'))
            ->where('trial_ends_at', '<=', $fenetre->to->format('Y-m-d H:i:s.u'))
            ->select(['id', 'organization_id', 'trial_ends_at'])->lazyById(500)
            ->map(fn (Subscription $abonnement): ReminderHit => new ReminderHit(
                $abonnement->id,
                CarbonImmutable::parse($abonnement->trial_ends_at),
                organizationId: $abonnement->organization_id,
                params: ['date' => (string) $abonnement->trial_ends_at?->toDateString()],
            ));
    }
}
