<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Notifications\Data\NotificationInput;
use App\Modules\Notifications\Enums\NotificationAudience;
use App\Modules\Notifications\Enums\NotificationType;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Parties\PublicApi\OwnerLinks;
use App\Modules\Parties\PublicApi\PartyLinks;
use Carbon\CarbonImmutable;

/**
 * Destinataires d'un événement, résolus sous le contexte de l'organisation de l'événement (ADR 0027).
 */
final readonly class Recipients
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private LeaseParticipants $participants,
        private PartyLinks $liens,
        private OwnerLinks $proprietaires,
        private LeaseDirectory $baux,
        private MandateDirectory $mandats,
    ) {}

    /**
     * @return list<string> comptes destinataires, sans doublon
     */
    public function for(NotificationInput $entree, ?LeaseData $bail): array
    {
        $comptes = $this->resolve($entree, $bail);

        return $entree->recipientId === null ? $comptes : array_values(array_intersect($comptes, [$entree->recipientId]));
    }

    /**
     * @return list<string>
     */
    private function resolve(NotificationInput $entree, ?LeaseData $bail): array
    {
        if ($entree->type->audience() === NotificationAudience::Staff) {
            $roles = $entree->type->roles();
            $comptes = [];

            foreach ($this->adhesions->activeTeam() as $membre) {
                if (in_array($membre->role, $roles, true)) {
                    $comptes[$membre->userId] = $membre->userId;
                }
            }

            if ($entree->assigneeId !== null && isset($comptes[$entree->assigneeId])) {
                return [$entree->assigneeId];
            }

            return array_values($comptes);
        }

        if ($entree->type->audience() === NotificationAudience::Account) {
            return $entree->recipientId === null || ! User::query()->whereKey($entree->recipientId)->exists() ? [] : [$entree->recipientId];
        }

        if ($entree->type->audience() === NotificationAudience::Owner) {
            return $entree->partyId === null ? [] : $this->fenetreMandant($entree, $this->proprietaires->accountsOfMandant($entree->partyId, [OwnerAccessRole::Holder, OwnerAccessRole::Representative]));
        }

        if ($entree->partyId !== null) {
            return $this->fenetreLocataire($entree, array_values(array_unique($this->liens->accountsOf([$entree->partyId]))));
        }

        if ($bail === null) {
            return [];
        }

        $jour = CarbonImmutable::parse(max($bail->startsOn, CarbonImmutable::today()->toDateString()));
        $parties = array_map(fn ($ligne): string => $ligne->partyId, $this->participants->tenantsAt($bail->id, $jour));

        return array_values(array_unique($this->liens->accountsOf(array_values(array_unique($parties)))));
    }

    /**
     * Un message ne prévient que le compte qui peut encore lire le fil : bail de `visibleToTenant()`, grâce de 12 mois comprise.
     *
     * @param  list<string>  $comptes
     * @return list<string>
     */
    private function fenetreLocataire(NotificationInput $entree, array $comptes): array
    {
        if (! in_array($entree->type, [NotificationType::TenantMessageReceived, NotificationType::TenantMessageRedacted, NotificationType::TenantAnnouncement], true) || $entree->leaseId === null) {
            return $comptes;
        }

        $aujourdhui = CarbonImmutable::today();

        return array_values(array_filter($comptes, fn (string $compte): bool => array_filter(
            $this->baux->visibleToTenant($compte, $aujourdhui),
            fn ($cle): bool => $cle->organizationId === $entree->organizationId && $cle->leaseId === $entree->leaseId,
        ) !== []));
    }

    /**
     * Idem pour le mandant : le couple (organisation, mandant) doit figurer dans `visibleToOwner()`, donc accès vivant et fenêtre ouverte.
     *
     * @param  list<string>  $comptes
     * @return list<string>
     */
    private function fenetreMandant(NotificationInput $entree, array $comptes): array
    {
        if (! in_array($entree->type, [NotificationType::OwnerMessageReceived, NotificationType::OwnerMessageRedacted, NotificationType::OwnerAnnouncement], true)) {
            return $comptes;
        }

        return array_values(array_filter($comptes, fn (string $compte): bool => array_filter(
            $this->mandats->visibleToOwner($compte),
            fn ($visible): bool => $visible->organizationId === $entree->organizationId
                && $visible->mandantPartyId === $entree->partyId
                && in_array($visible->role, [OwnerAccessRole::Holder, OwnerAccessRole::Representative], true),
        ) !== []));
    }
}
