<?php

declare(strict_types=1);

namespace App\Modules\Planning\Support;

use App\Modules\Organizations\Data\TeamMemberData;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\Planning\Enums\ErrorCode;

/**
 * Membres actifs de l'organisation courante : seuls eux peuvent être responsables d'une tâche ou participer à un événement.
 */
final readonly class Assignees
{
    public function __construct(private MembershipDirectory $adhesions) {}

    public function assertActive(string $userId): void
    {
        if (! isset($this->activeIds()[$userId])) {
            throw ErrorCode::AssigneeInvalid->problem();
        }
    }

    /**
     * @param  list<string>  $userIds
     */
    public function assertAllActive(array $userIds): void
    {
        $actifs = $this->activeIds();

        foreach ($userIds as $id) {
            isset($actifs[$id]) || throw ErrorCode::AssigneeInvalid->problem();
        }
    }

    /**
     * @return array<string, true>
     */
    private function activeIds(): array
    {
        return array_fill_keys(array_map(fn (TeamMemberData $m): string => $m->userId, $this->adhesions->activeTeam()), true);
    }
}
