<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Enums\BillingTiming;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\Periodicity;

final readonly class LeaseData
{
    /**
     * @param  string  $startsOn  Y-m-d
     * @param  ?string  $endsOn  Y-m-d, exclu
     * @param  ?string  $noticeDepartureOn  Y-m-d, départ annoncé par le préavis
     * @param  ?string  $noticeReceivedOn  Y-m-d, réception du préavis
     * @param  list<LeaseUnitData>  $units  lots du bail, principal d'abord
     */
    public function __construct(
        public string $id,
        public string $reference,
        public string $jurisdiction,
        public string $regimeKey,
        public LeaseStatus $status,
        public string $startsOn,
        public ?string $endsOn,
        public ?string $noticeDepartureOn,
        public ?string $signedOn,
        public int $dueDay,
        public Periodicity $periodicity,
        public BillingTiming $billingTiming,
        public string $currency,
        public bool $isArchived,
        public array $units,
        public ?string $noticeReceivedOn = null,
    ) {}
}
