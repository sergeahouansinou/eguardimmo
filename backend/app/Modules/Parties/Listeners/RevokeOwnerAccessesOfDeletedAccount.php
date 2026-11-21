<?php

declare(strict_types=1);

namespace App\Modules\Parties\Listeners;

use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Parties\Actions\RevokeOwnerAccess;
use App\Modules\Parties\Queries\OwnerAccesses;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Contracts\Queue\ShouldQueue;

final class RevokeOwnerAccessesOfDeletedAccount implements ShouldQueue
{
    public int $tries = 5;

    public function __construct(
        private readonly OwnerAccesses $acces,
        private readonly CurrentOrganization $organisation,
        private readonly RevokeOwnerAccess $revocation,
    ) {}

    /**
     * Idempotent : un accès déjà révoqué n'est plus sélectionné.
     */
    public function handle(AccountDeleted $evenement): void
    {
        foreach ($this->acces->allActiveOfAccount($evenement->userId) as $acces) {
            $this->organisation->run($acces->organization_id, fn () => $this->revocation->handle($acces, OwnerRevoker::System, null));
        }
    }
}
