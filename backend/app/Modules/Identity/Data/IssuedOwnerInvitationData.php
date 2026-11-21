<?php

declare(strict_types=1);

namespace App\Modules\Identity\Data;

use SensitiveParameter;

/**
 * Le code d'appariement n'existe en clair que dans cet objet : il n'est jamais stocké ni journalisé.
 */
final readonly class IssuedOwnerInvitationData
{
    public function __construct(
        public OwnerInvitationData $invitation,
        #[SensitiveParameter] public string $pairingCode,
    ) {}
}
