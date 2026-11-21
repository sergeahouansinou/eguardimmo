<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Demande classée sans suite ; le motif reste dans l'intervention, jamais dans l'événement.
 */
final readonly class InterventionDeclined implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $interventionId,
        public string $organizationId,
        public ?string $leaseId,
        public string $reference,
    ) {}
}
