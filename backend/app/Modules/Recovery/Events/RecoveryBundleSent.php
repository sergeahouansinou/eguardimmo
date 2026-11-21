<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Un envoi de pièces est transmis (ADR 0005 : Recovery ⇢ RecoveryBundleSent ⇢ Notifications). Le jeton en clair n'existe
 * que dans cet événement et dans l'e-mail qui en découle : seule son empreinte est stockée.
 */
final readonly class RecoveryBundleSent implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $organizationId,
        public string $transmissionId,
        #[\SensitiveParameter] public string $token,
    ) {}
}
