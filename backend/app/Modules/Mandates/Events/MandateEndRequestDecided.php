<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Events;

use App\Modules\Mandates\Enums\EndRequestStatus;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * L'agence a statué sur la demande de fin de mandat : rejet ou résiliation. Ni note ni nom : des identifiants.
 */
final readonly class MandateEndRequestDecided implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $organizationId,
        public string $mandateId,
        public string $mandantPartyId,
        public string $requestId,
        public string $reference,
        public EndRequestStatus $decision,
    ) {}
}
