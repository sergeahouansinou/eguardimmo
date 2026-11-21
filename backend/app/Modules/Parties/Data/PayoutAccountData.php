<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use Carbon\CarbonImmutable;

final readonly class PayoutAccountData
{
    /**
     * Compte de paiement d'une partie : jamais l'IBAN complet. `recordedAt` est la date serveur de saisie du compte
     * (le changement de coordonnées se juge dessus, pas sur la date de début de validité saisie).
     */
    public function __construct(
        public string $bankAccountId,
        public string $partyId,
        public string $last4,
        public CarbonImmutable $recordedAt,
    ) {}
}
