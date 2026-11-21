<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

use Money\Money;

final readonly class LeaseRentBalanceData
{
    /**
     * @param  Money  $balance  compte locataire du bail au grand livre : positif = dû par le locataire, négatif = avance
     * @param  Money  $overdue  somme des restes dus des échéances appelées dont la date est dépassée
     * @param  Money  $advance  trop-perçu non imputé (zéro quand il n'y en a pas)
     * @param  ?string  $oldestUnpaidDueDate  Y-m-d de la plus ancienne échéance impayée
     */
    public function __construct(
        public string $leaseId,
        public Money $balance,
        public Money $overdue,
        public Money $advance,
        public int $unpaidCount,
        public ?string $oldestUnpaidDueDate,
    ) {}
}
