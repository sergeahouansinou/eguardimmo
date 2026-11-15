<?php

declare(strict_types=1);

namespace App\Modules\Organizations\PublicApi;

use App\Modules\Organizations\Data\MembershipData;
use App\Modules\Organizations\Data\TeamMemberData;
use App\Modules\Organizations\Queries\Memberships;

final readonly class MembershipDirectory
{
    public function __construct(private Memberships $adhesions) {}

    public function activeMembership(string $userId, string $organizationId): ?MembershipData
    {
        foreach ($this->adhesions->activeFor($userId) as $adhesion) {
            if ($adhesion->organizationId === $organizationId) {
                return $adhesion;
            }
        }

        return null;
    }

    /**
     * @return list<MembershipData>
     */
    public function membershipsOf(string $userId): array
    {
        return $this->adhesions->activeFor($userId);
    }

    /**
     * Membres actifs de l'organisation courante.
     *
     * @return list<TeamMemberData>
     */
    public function activeTeam(): array
    {
        return $this->adhesions->activeTeam();
    }
}
