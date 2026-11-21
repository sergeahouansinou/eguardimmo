<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Changement de compte de paiement d'un mandant. Ni IBAN, ni nom, ni code : des identifiants seulement.
 */
final readonly class PayoutAccountChangeContested implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public string $organizationId,
        public string $mandantPartyId,
        public string $holdId,
    ) {}
}
