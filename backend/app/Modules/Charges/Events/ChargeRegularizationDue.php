<?php

declare(strict_types=1);

namespace App\Modules\Charges\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Un bail à provisions n'a pas de décompte émis pour une période terminée depuis trop longtemps (ADR 0034 § 11).
 */
final readonly class ChargeRegularizationDue implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $leaseId,
        public string $organizationId,
        public int $year,
    ) {}
}
