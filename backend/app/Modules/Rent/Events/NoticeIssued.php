<?php

declare(strict_types=1);

namespace App\Modules\Rent\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Avis d'échéance émis (ADR 0027 : Rent ⇢ NoticeIssued ⇢ Notifications).
 */
final readonly class NoticeIssued implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $installmentId,
        public string $leaseId,
        public string $organizationId,
        public string $dueDate,
    ) {}
}
