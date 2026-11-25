<?php

declare(strict_types=1);

namespace App\Modules\Listings\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Une demande de visite attend une réponse de l'organisation hôte ; aucune donnée de la demande ne voyage dans l'événement.
 */
final readonly class VisitRequested implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $leadId,
        public string $organizationId,
        public string $listingId,
        public string $userId,
    ) {}
}
