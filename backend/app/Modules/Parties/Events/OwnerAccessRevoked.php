<?php

declare(strict_types=1);

namespace App\Modules\Parties\Events;

use App\Modules\Identity\Enums\OwnerRevoker;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Un accès propriétaire vient d'être révoqué ; le consommateur décide des suites (e-mail au compte, nettoyage).
 */
final readonly class OwnerAccessRevoked implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $accessId,
        public string $organizationId,
        public string $userId,
        public string $mandantPartyId,
        public OwnerRevoker $by,
    ) {}
}
