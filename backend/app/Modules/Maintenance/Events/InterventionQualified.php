<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Demande prise en charge par l'équipe.
 */
final readonly class InterventionQualified implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $interventionId,
        public string $organizationId,
        public ?string $leaseId,
        public string $reference,
    ) {}
}
