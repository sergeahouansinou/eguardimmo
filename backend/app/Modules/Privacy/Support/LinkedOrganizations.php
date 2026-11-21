<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Support;

use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Parties\Data\LinkedPartyData;
use App\Modules\Parties\PublicApi\OwnerLinks;
use App\Modules\Parties\PublicApi\PartyLinks;

/**
 * Organisations qui détiennent des données liées à un compte : adhésions, rattachements locataire et accès mandant, lus comme pour `/me/profiles`.
 */
final readonly class LinkedOrganizations
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private PartyLinks $locataires,
        private OwnerLinks $mandants,
    ) {}

    /**
     * @return list<string>
     */
    public function of(string $userId): array
    {
        $ids = [
            ...array_map(fn ($adhesion): string => $adhesion->organizationId, $this->adhesions->membershipsOf($userId)),
            ...array_map(fn (LinkedPartyData $lien): string => $lien->organizationId, $this->locataires->linkedTo($userId)),
            ...array_map(fn ($acces): string => $acces->organizationId, $this->mandants->activeFor($userId)),
        ];

        return array_values(array_unique($ids));
    }
}
