<?php

declare(strict_types=1);

namespace App\Modules\Rent\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Encaissement enregistré ; jamais émis pour un rejeu d'idempotence (ADR 0027).
 */
final readonly class PaymentRecorded implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $paymentId,
        public string $leaseId,
        public string $organizationId,
    ) {}
}
