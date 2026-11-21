<?php

declare(strict_types=1);

namespace App\Modules\Identity\Listeners;

use App\Modules\Identity\Actions\RevokeOwnerInvitation;
use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\OwnerInvitations;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Une invitation en attente garde l'adresse en clair : celle d'un compte supprimé n'a plus lieu d'être.
 */
final class RevokeOwnerInvitationsOfDeletedAccount implements ShouldQueue
{
    public int $tries = 5;

    public function __construct(
        private readonly OwnerInvitations $invitations,
        private readonly CurrentOrganization $organisation,
        private readonly RevokeOwnerInvitation $revocation,
    ) {}

    /**
     * Idempotent : une invitation déjà révoquée n'est plus sélectionnée.
     */
    public function handle(AccountDeleted $evenement): void
    {
        $compte = User::withTrashed()->find($evenement->userId);

        if ($compte === null) {
            return;
        }

        foreach ($this->invitations->pendingForEmail($compte->email) as $invitation) {
            $this->organisation->run($invitation->organization_id, fn () => $this->revocation->handle([$invitation->id], [], OwnerRevoker::System, null));
        }
    }
}
