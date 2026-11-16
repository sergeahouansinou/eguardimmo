<?php

declare(strict_types=1);

namespace App\Modules\Leases\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Les lignes de composantes d'un bail signé ont changé à partir de $effectiveOn : Rent recalcule les échéances non émises.
 */
final readonly class LeaseTermsRevised implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $leaseId,
        public string $organizationId,
        public string $effectiveOn,
    ) {}
}
