<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\PublicApi\OwnerInvitations;
use App\Modules\Parties\Queries\OwnerAccesses;
use Illuminate\Support\Facades\DB;

final readonly class RevokeOwnerAccessesOfParties
{
    public function __construct(
        private OwnerAccesses $acces,
        private OwnerInvitations $invitations,
        private RevokeOwnerAccess $revocation,
    ) {}

    /**
     * Suppose un contexte d'organisation. Révoque les accès vivants et les invitations en attente dont le mandant ou la personne
     * est l'une de ces parties (anonymisation) ; renvoie le nombre d'accès révoqués.
     *
     * @param  list<string>  $partyIds
     */
    public function handle(array $partyIds, OwnerRevoker $par, ?string $acteurId): int
    {
        return DB::transaction(function () use ($partyIds, $par, $acteurId): int {
            $acces = $this->acces->activeOfParties($partyIds);

            foreach ($acces as $a) {
                $this->revocation->handle($a, $par, $acteurId);
            }

            $this->invitations->revokeForParties($partyIds, $par, $acteurId);

            return $acces->count();
        });
    }
}
