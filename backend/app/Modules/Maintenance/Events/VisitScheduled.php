<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Rendez-vous proposé, confirmé ou modifié par l'équipe ; la clé de notification porte la version de la visite.
 */
final readonly class VisitScheduled implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    /**
     * @param  string  $scheduledOn  Y-m-d
     */
    public function __construct(
        public string $interventionId,
        public string $visitId,
        public int $visitVersion,
        public string $organizationId,
        public ?string $leaseId,
        public string $reference,
        public string $scheduledOn,
    ) {}
}
