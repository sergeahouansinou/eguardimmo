<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Queries;

use App\Modules\Subscriptions\Data\SubscriptionSummaryData;
use App\Modules\Subscriptions\Enums\SubscriptionStatus;
use App\Modules\Subscriptions\Models\Subscription;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;

final class SubscriptionList
{
    /**
     * @return CursorPaginator<int, Subscription>
     */
    public function page(?SubscriptionStatus $statut, ?string $planCode, bool $essaiFinissant, ?string $curseur, int $parPage): CursorPaginator
    {
        return AcrossOrganizations::query(Subscription::class)
            ->with('planVersion.plan')
            ->when($statut !== null, fn (Builder $q): Builder => $q->where('status', $statut))
            ->when($planCode !== null, fn (Builder $q): Builder => $q->whereHas('planVersion.plan', fn (Builder $p): Builder => $p->where('code', $planCode)))
            ->when($essaiFinissant, fn (Builder $q): Builder => $q->where('status', SubscriptionStatus::Trialing)->whereBetween('trial_ends_at', [now(), now()->addDays(3)]))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    /**
     * @param  list<string>  $organizationIds
     * @return array<string, SubscriptionSummaryData>
     */
    public function summaries(array $organizationIds): array
    {
        if ($organizationIds === []) {
            return [];
        }

        $resume = [];
        foreach (AcrossOrganizations::query(Subscription::class)->with('planVersion.plan')->whereIn('organization_id', $organizationIds)->get() as $abonnement) {
            $resume[$abonnement->organization_id] = new SubscriptionSummaryData($abonnement->organization_id, $abonnement->planVersion->plan->code, $abonnement->status->value, $abonnement->trial_ends_at);
        }

        return $resume;
    }

    /**
     * @return list<string>
     */
    public function organizationIdsWhere(?string $planCode, ?string $statut): array
    {
        return array_values(AcrossOrganizations::query(Subscription::class)
            ->when($statut !== null, fn (Builder $q): Builder => $q->where('status', $statut))
            ->when($planCode !== null, fn (Builder $q): Builder => $q->whereHas('planVersion.plan', fn (Builder $p): Builder => $p->where('code', $planCode)))
            ->pluck('organization_id')
            ->map(fn (mixed $id): string => (string) $id)
            ->all());
    }
}
