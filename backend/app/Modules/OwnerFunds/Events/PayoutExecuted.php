<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Virement exécuté à la banque pour un mandant d'un lot. Aucun montant, aucun IBAN : des identifiants seulement.
 */
final readonly class PayoutExecuted implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $organizationId,
        public string $batchId,
        public string $itemId,
        public string $batchNumber,
        public string $mandantPartyId,
    ) {}
}
