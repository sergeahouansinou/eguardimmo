<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Parties\PublicApi\OwnerLinks;
use App\Modules\Parties\PublicApi\PartyLinks;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

/**
 * Ce que l'équipe peut viser en ouvrant un fil : une fiche qui a un compte, sur un bail que ce compte lit (locataire) ou un mandant
 * dont un compte a un accès vivant (propriétaire). Jamais cru du client ; suppose le contexte de l'organisation.
 */
final readonly class ExternalRecipients
{
    public function __construct(
        private PartyLinks $liens,
        private OwnerLinks $acces,
        private LeaseDirectory $baux,
        private MandateDirectory $mandats,
        private CurrentOrganization $organisation,
    ) {}

    public function assertReachable(ConversationKind $kind, string $partyId, ?string $leaseId, ?string $mandateId): void
    {
        match ($kind) {
            ConversationKind::Tenant => $this->assertTenant($partyId, $leaseId),
            ConversationKind::Owner => $this->assertOwner($partyId, $mandateId),
            ConversationKind::Internal => throw ErrorCode::RecipientNotFound->problem(),
        };
    }

    private function assertTenant(string $partyId, ?string $leaseId): void
    {
        $compte = $this->liens->accountsOf([$partyId])[$partyId] ?? throw ErrorCode::RecipientNotFound->problem();

        if ($leaseId === null) {
            throw ErrorCode::ConversationLinkNotFound->problem();
        }

        $lit = array_filter(
            $this->baux->visibleToTenant($compte, CarbonImmutable::today()),
            fn ($cle): bool => $cle->organizationId === $this->organisation->id() && $cle->leaseId === $leaseId,
        );

        if ($lit === []) {
            throw ErrorCode::ConversationLinkNotFound->problem();
        }
    }

    private function assertOwner(string $partyId, ?string $mandateId): void
    {
        if ($this->acces->accountsOfMandant($partyId, [OwnerAccessRole::Holder, OwnerAccessRole::Representative]) === []) {
            throw ErrorCode::RecipientNotFound->problem();
        }

        if ($mandateId !== null && $this->mandats->find($mandateId)->mandantPartyId !== $partyId) {
            throw ErrorCode::ConversationLinkNotFound->problem();
        }
    }
}
