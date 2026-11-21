<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Support;

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Request;

/**
 * Les notes internes du mandat sont masquées au comptable, qui lit le reste.
 */
final readonly class NoteAccess
{
    public function __construct(
        private MembershipDirectory $adhesions,
        private CurrentOrganization $organisation,
    ) {}

    public function visibleTo(Request $request): bool
    {
        $utilisateur = $request->user();

        if ($utilisateur === null) {
            return false;
        }

        $adhesion = $this->adhesions->activeMembership((string) $utilisateur->getKey(), $this->organisation->id());

        return $adhesion !== null && $adhesion->role !== MemberRole::Accountant;
    }
}
