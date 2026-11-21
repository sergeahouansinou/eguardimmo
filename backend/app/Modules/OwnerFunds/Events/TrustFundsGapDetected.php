<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Écart de cantonnement constaté par le contrôle quotidien : les reversements, prélèvements et clôtures sont bloqués.
 */
final readonly class TrustFundsGapDetected implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $organizationId,
        public string $day,
    ) {}
}
