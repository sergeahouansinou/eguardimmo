<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Le locataire demande un autre créneau : l'équipe confirme ou contre-propose.
 */
final readonly class VisitRescheduleRequested implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $interventionId,
        public string $visitId,
        public int $visitVersion,
        public string $organizationId,
        public ?string $leaseId,
        public string $reference,
    ) {}
}
