<?php

declare(strict_types=1);

namespace App\Modules\Rent\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Quittance émise (ADR 0027 : Rent ⇢ ReceiptIssued ⇢ Notifications).
 */
final readonly class ReceiptIssued implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $receiptId,
        public string $installmentId,
        public string $leaseId,
        public string $organizationId,
    ) {}
}
