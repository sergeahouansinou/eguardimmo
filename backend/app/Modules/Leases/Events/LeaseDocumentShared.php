<?php

declare(strict_types=1);

namespace App\Modules\Leases\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * `partyId` nul : pièce partagée avec tous les locataires du bail (ADR 0036, décision 2).
 */
final readonly class LeaseDocumentShared implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $documentId,
        public string $leaseId,
        public string $organizationId,
        public ?string $partyId,
    ) {}
}
