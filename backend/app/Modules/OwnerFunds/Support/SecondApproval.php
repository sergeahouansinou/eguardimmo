<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Organizations\Data\TeamMemberData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Modules\OwnerFunds\Enums\ErrorCode;

/**
 * Double contrôle : celui qui exécute n'est pas celui qui a validé quand l'organisation comptait au moins deux membres
 * autorisés à la validation du lot ; sinon l'exécution est permise et journalisée « solo » (ADR 0031, décision 4).
 */
final readonly class SecondApproval
{
    public function __construct(private MembershipDirectory $equipe) {}

    /**
     * Instantané figé sur le lot à sa validation.
     *
     * @return array{required: bool, count: int}
     */
    public function snapshot(): array
    {
        $nombre = $this->habilites();

        return ['required' => (bool) config('owner_funds.require_second_approver') && $nombre >= 2, 'count' => $nombre];
    }

    /**
     * Le mode solo n'est permis que si l'exigence figée est nulle et que l'équipe habilitée n'a pas changé depuis la validation.
     *
     * @return bool vrai quand l'exécution est « solo »
     */
    public function check(bool $required, int $count, ?string $validatedBy, string $executedBy): bool
    {
        if ($validatedBy !== $executedBy) {
            return false;
        }

        if ($required || $this->habilites() !== $count) {
            throw ErrorCode::SecondApproverRequired->problem();
        }

        return true;
    }

    private function habilites(): int
    {
        return count(array_filter($this->equipe->activeTeam(), fn (TeamMemberData $m): bool => in_array($m->role, [MemberRole::Owner, MemberRole::Admin, MemberRole::Accountant], true)));
    }
}
