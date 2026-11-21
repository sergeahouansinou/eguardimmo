<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\AccountRole;
use Money\Money;

final readonly class CollectionMovementData
{
    /**
     * Encaissement imputé (net des contrepassations) sur un compte « appelé » : `amount` est signé.
     */
    public function __construct(
        public string $partyId,
        public ?string $unitId,
        public string $date,
        public AccountRole $role,
        public Money $amount,
    ) {}
}
