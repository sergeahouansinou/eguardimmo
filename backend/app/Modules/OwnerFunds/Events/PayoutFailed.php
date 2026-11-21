<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Virement échoué avant exécution : le montant est restitué au compte du mandant. Aucun montant, aucun IBAN : des identifiants seulement.
 */
final readonly class PayoutFailed implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $organizationId,
        public string $batchId,
        public string $itemId,
        public string $batchNumber,
    ) {}
}
