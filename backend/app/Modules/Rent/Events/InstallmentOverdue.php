<?php

declare(strict_types=1);

namespace App\Modules\Rent\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Avis impayé (ADR 0005 : Rent ⇢ AvisImpayé ⇢ Recovery). Émis une seule fois par échéance, à la première détection
 * (`installments.overdue_notified_at`) ; la tâche `rent:generate` sert de rattrapage. Le reste dû se lit par `RentLedger`.
 */
final readonly class InstallmentOverdue implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $installmentId,
        public string $leaseId,
        public string $organizationId,
        public string $dueDate,
    ) {}
}
