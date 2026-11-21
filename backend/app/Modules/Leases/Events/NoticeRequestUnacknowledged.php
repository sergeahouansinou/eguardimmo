<?php

declare(strict_types=1);

namespace App\Modules\Leases\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Aucun accusé de réception dans le délai : l'agence et le locataire sont prévenus, une seule fois par demande.
 */
final readonly class NoticeRequestUnacknowledged implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $requestId,
        public string $leaseId,
        public string $organizationId,
        public string $partyId,
    ) {}
}
