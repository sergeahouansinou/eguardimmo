<?php

declare(strict_types=1);

namespace App\Modules\Leases\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Un colocataire quitte le bail à $leftOn (exclu) : le bail continue avec les autres locataires.
 */
final readonly class LeaseTenantLeft implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $leaseId,
        public string $organizationId,
        public string $partyId,
        public string $leftOn,
    ) {}
}
