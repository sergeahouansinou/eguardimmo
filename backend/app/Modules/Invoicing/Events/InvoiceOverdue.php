<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Facture échue et non soldée (ADR 0005 : Invoicing ⇢ InvoiceOverdue ⇢ Notifications). Émis une seule fois par facture, à
 * la première détection (`invoices.overdue_flagged_at`) ; le reste dû se lit par `InvoiceLedger`.
 */
final readonly class InvoiceOverdue implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $invoiceId,
        public string $organizationId,
        public ?string $leaseId,
        public string $dueOn,
    ) {}
}
