<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use Money\Money;

final readonly class OwnerFundsBalanceData
{
    /**
     * @param  Money  $payable  solde `OwnerPayable` (crédit − débit) ; négatif si le compte est débiteur
     * @param  Money  $inTransit  reversements validés non exécutés (`PayoutsInTransit`)
     * @param  Money  $called  loyers, charges et TVA appelés pour le mandant et pas encore encaissés
     */
    public function __construct(
        public string $partyId,
        public Money $payable,
        public Money $inTransit,
        public Money $called,
    ) {}
}
