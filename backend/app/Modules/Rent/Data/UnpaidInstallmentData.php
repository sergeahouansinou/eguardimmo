<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

use App\Modules\Rent\Enums\InstallmentStatus;
use Money\Money;

final readonly class UnpaidInstallmentData
{
    /**
     * @param  string  $periodStart  Y-m-d
     * @param  string  $periodEnd  Y-m-d, jour compris
     * @param  string  $dueDate  Y-m-d
     * @param  Money  $outstanding  reste dû lu au grand livre
     */
    public function __construct(
        public string $installmentId,
        public string $leaseId,
        public ?string $partyId,
        public string $periodStart,
        public string $periodEnd,
        public string $dueDate,
        public InstallmentStatus $status,
        public Money $total,
        public Money $outstanding,
    ) {}
}
