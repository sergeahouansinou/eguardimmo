<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Enums\BillingTiming;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\Periodicity;

final readonly class LeaseBillingData
{
    /**
     * @param  string  $startsOn  Y-m-d
     * @param  ?string  $effectiveEndsOn  Y-m-d, exclu : le plus tôt de la fin du bail et du départ annoncé ; null sans fin
     */
    public function __construct(
        public string $leaseId,
        public string $reference,
        public LeaseStatus $status,
        public int $dueDay,
        public Periodicity $periodicity,
        public BillingTiming $billingTiming,
        public string $currency,
        public string $startsOn,
        public ?string $effectiveEndsOn,
    ) {}
}
