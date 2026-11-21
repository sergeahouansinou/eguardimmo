<?php

declare(strict_types=1);

namespace App\Modules\Parties\Listeners;

use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\Events\OwnerAccessRevoked;
use App\Modules\Parties\Notifications\OwnerAccessRevokedNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Notification;

final class NotifyOwnerOfRevokedAccess implements ShouldQueue
{
    public int $tries = 5;

    public function __construct(private readonly OrganizationDirectory $organisations) {}

    /**
     * Pas de message au compte qui s'est retiré lui-même, ni à un compte supprimé (il n'est plus lisible).
     */
    public function handle(OwnerAccessRevoked $evenement): void
    {
        if ($evenement->by === OwnerRevoker::Account) {
            return;
        }

        $compte = User::query()->find($evenement->userId);

        if ($compte === null) {
            return;
        }

        $nom = $this->organisations->names([$evenement->organizationId])[$evenement->organizationId] ?? '';
        Notification::send($compte, new OwnerAccessRevokedNotification($nom));
    }
}
