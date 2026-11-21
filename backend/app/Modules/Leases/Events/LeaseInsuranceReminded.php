<?php

declare(strict_types=1);

namespace App\Modules\Leases\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Relance de l'agence aux locataires du bail ; `date` (Y-m-d) fait la clé de déduplication de la notification.
 */
final readonly class LeaseInsuranceReminded implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $leaseId,
        public string $organizationId,
        public string $date,
    ) {}
}
