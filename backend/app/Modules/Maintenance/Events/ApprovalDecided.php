<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Réponse du mandant (acceptée, refusée ou question), saisie par l'équipe (`agency_recorded`) ou par le mandant dans son espace (`owner_space`).
 */
final readonly class ApprovalDecided implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $interventionId,
        public string $approvalId,
        public string $status,
        public string $organizationId,
        public string $reference,
        public string $decidedVia,
        public ?string $mandantPartyId,
    ) {}
}
