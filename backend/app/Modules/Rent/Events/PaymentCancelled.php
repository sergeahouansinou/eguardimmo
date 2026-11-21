<?php

declare(strict_types=1);

namespace App\Modules\Rent\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Encaissement annulé ; jamais émis pour une annulation déjà faite (ADR 0027).
 */
final readonly class PaymentCancelled implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $paymentId,
        public string $leaseId,
        public string $organizationId,
    ) {}
}
