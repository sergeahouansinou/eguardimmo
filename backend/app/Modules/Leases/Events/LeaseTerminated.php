<?php

declare(strict_types=1);

namespace App\Modules\Leases\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Le bail s'arrête à $endsOn (exclu) : Rent cesse d'émettre à partir de cette date.
 */
final readonly class LeaseTerminated implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $leaseId,
        public string $organizationId,
        public string $endsOn,
    ) {}
}
