<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class Operators
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private CurrentOrganization $contexte,
    ) {}

    public function userId(): ?string
    {
        $id = auth()->id();

        return is_string($id) ? $id : null;
    }

    /**
     * Un bailleur autonome décide seul (`self_managed`) : aucun mandat, aucun accord. Sans compte connecté, l'organisation
     * est tenue pour une agence (le refus est alors le cas sûr).
     */
    public function isIndividualOrganization(): bool
    {
        $utilisateur = $this->userId();

        return $utilisateur !== null && $this->adhesions->activeMembership($utilisateur, $this->contexte->id())?->kind === OrganizationKind::Individual;
    }
}
