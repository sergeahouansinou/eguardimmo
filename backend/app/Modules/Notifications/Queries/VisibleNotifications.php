<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Queries;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Notifications\Data\NotificationFilters;
use App\Modules\Notifications\Enums\NotificationAudience;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Clé de lecture des notifications (ADR 0027) : le compte connecté, et seulement ce que son appartenance actuelle lui
 * permet encore de voir. Un ex-membre, un rôle rétrogradé ou un locataire hors grâce ne voit plus la ligne.
 */
final readonly class VisibleNotifications
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private LeaseDirectory $baux,
        private MandateDirectory $mandats,
    ) {}

    /**
     * @return Builder<Notification>
     */
    public function for(string $userId, NotificationFilters $filtres = new NotificationFilters): Builder
    {
        $requete = Notification::query()
            ->where('user_id', $userId)
            ->where('in_app', true)
            ->whereNull('archived_at');

        $equipe = $this->adhesions->membershipsOf($userId);
        $baux = array_map(fn ($cle): string => $cle->leaseId, $this->baux->visibleToTenant($userId, CarbonImmutable::today()));
        $mandants = array_values(array_filter(
            $this->mandats->visibleToOwner($userId),
            fn ($visible): bool => $visible->role !== OwnerAccessRole::CoOwner,
        ));

        $requete->where(function (Builder $q) use ($equipe, $baux, $mandants): void {
            $q->whereRaw('1 = 0');

            foreach ($equipe as $adhesion) {
                $types = array_map(fn (NotificationType $type): string => $type->value, NotificationType::forRole($adhesion->role));
                $q->orWhere(fn (Builder $groupe): Builder => $groupe
                    ->where('audience', NotificationAudience::Staff->value)
                    ->where('organization_id', $adhesion->organizationId)
                    ->whereIn('type', $types));
            }

            foreach ($mandants as $visible) {
                $q->orWhere(fn (Builder $groupe): Builder => $groupe
                    ->where('audience', NotificationAudience::Owner->value)
                    ->where('organization_id', $visible->organizationId)
                    ->where('party_id', $visible->mandantPartyId));
            }

            $q->orWhere(fn (Builder $groupe): Builder => $groupe
                ->where('audience', NotificationAudience::Account->value)
                ->whereNull('organization_id'));

            if ($baux !== []) {
                $q->orWhere(fn (Builder $groupe): Builder => $groupe
                    ->where('audience', NotificationAudience::Tenant->value)
                    ->whereIn('lease_id', $baux));
            }
        });

        if ($filtres->organizationId !== null) {
            $requete->where('organization_id', $filtres->organizationId);
        }

        if ($filtres->unreadOnly) {
            $requete->whereNull('read_at');
        }

        return $requete;
    }
}
