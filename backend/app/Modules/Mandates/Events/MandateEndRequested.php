<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Un mandant demande la fin de son mandat. Ni motif ni nom : des identifiants et la référence du mandat.
 */
final readonly class MandateEndRequested implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $organizationId,
        public string $mandateId,
        public string $mandantPartyId,
        public string $requestId,
        public string $reference,
    ) {}
}
