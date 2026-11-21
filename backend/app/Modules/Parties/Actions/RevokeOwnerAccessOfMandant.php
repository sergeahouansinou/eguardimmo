<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\PublicApi\OwnerInvitations;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Queries\OwnerAccesses;
use Illuminate\Support\Facades\DB;

final readonly class RevokeOwnerAccessOfMandant
{
    public function __construct(
        private OwnerAccesses $acces,
        private OwnerInvitations $invitations,
        private RevokeOwnerAccess $revocation,
    ) {}

    /**
     * Suppose un contexte d'organisation. La référence désigne un accès vivant ou une invitation en attente du mandant ;
     * toute autre référence, y compris celle d'un autre mandant ou d'une autre organisation, répond 404.
     */
    public function handle(Party $mandant, string $reference, string $acteurId): void
    {
        DB::transaction(function () use ($mandant, $reference, $acteurId): void {
            $acces = $this->acces->activeOfMandant($mandant->id, $reference);

            if ($acces !== null) {
                $this->revocation->handle($acces, OwnerRevoker::Organization, $acteurId);

                return;
            }

            $attente = array_filter($this->invitations->pendingForMandant($mandant->id), fn ($i): bool => $i->id === strtolower($reference));

            if ($attente === [] || $this->invitations->revoke([strtolower($reference)], OwnerRevoker::Organization, $acteurId) === 0) {
                throw ErrorCode::OwnerAccessNotFound->problem();
            }
        });
    }
}
