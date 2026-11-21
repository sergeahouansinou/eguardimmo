<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Demande d'accord expirée sans réponse : le silence n'est pas un accord.
 */
final readonly class ApprovalExpired implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $interventionId,
        public string $approvalId,
        public string $organizationId,
        public string $reference,
        public ?string $mandantPartyId,
    ) {}
}
