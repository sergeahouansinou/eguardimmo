<?php

declare(strict_types=1);

namespace App\Modules\Charges\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Décompte de charges émis (ADR 0034 : Charges ⇢ ChargeStatementIssued ⇢ Notifications). Ni montant ni pièce dans l'événement.
 */
final readonly class ChargeStatementIssued implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $statementId,
        public string $leaseId,
        public string $organizationId,
    ) {}
}
