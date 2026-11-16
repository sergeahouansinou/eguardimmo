<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Enums\BillingTiming;
use App\Modules\Leases\Enums\PaymentMethod;
use App\Modules\Leases\Enums\Periodicity;

final readonly class NewLeaseData
{
    /**
     * @param  string  $startsOn  Y-m-d
     * @param  ?int  $durationMonths  défaut : celui du régime
     * @param  ?bool  $tacitRenewal  défaut : celui du régime
     * @param  array<string, mixed>  $jurisdictionData
     * @param  array<string, mixed>  $customFields
     * @param  list<NewLeaseUnitData>  $units
     * @param  list<NewLeasePartyData>  $parties
     * @param  list<NewLeaseTermData>  $terms
     */
    public function __construct(
        public string $jurisdiction,
        public string $regimeKey,
        public string $startsOn,
        public ?int $durationMonths,
        public ?bool $tacitRenewal,
        public int $dueDay,
        public Periodicity $periodicity,
        public BillingTiming $billingTiming,
        public ?PaymentMethod $paymentMethod,
        public array $jurisdictionData,
        public array $customFields,
        public ?string $note,
        public array $units,
        public array $parties,
        public array $terms,
    ) {}
}
