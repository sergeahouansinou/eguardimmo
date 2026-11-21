<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use App\Modules\Parties\Enums\BankAccountStatus;

final readonly class BankAccountStateData
{
    /**
     * Jamais l'IBAN complet : quatre derniers caractères et titulaire saisi.
     */
    public function __construct(
        public string $id,
        public string $partyId,
        public string $last4,
        public string $holderName,
        public BankAccountStatus $status,
    ) {}
}
