<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Demande du locataire enregistrée ; la notification de l'équipe est dédoublonnée par intervention (ADR 0027).
 */
final readonly class ServiceRequestReported implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $interventionId,
        public string $organizationId,
        public ?string $leaseId,
        public string $reference,
    ) {}
}
