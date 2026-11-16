<?php

declare(strict_types=1);

namespace App\Modules\Leases\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Le terme du bail passe de $previousEndsOn à $endsOn (exclus) : Rent étend l'échéancier sur la prolongation.
 */
final readonly class LeaseRenewed implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $leaseId,
        public string $organizationId,
        public string $previousEndsOn,
        public string $endsOn,
    ) {}
}
