<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Jurisdictions\LeaseRegime;

final readonly class RegimeTermsData
{
    public function __construct(
        public int $defaultDurationMonths,
        public int $minimumDurationMonths,
        public ?int $maximumDurationMonths,
        public bool $tacitRenewal,
        public ?int $renewalMonths,
        public ?int $depositCapMonths,
        public ?int $tenantNoticeMonths,
        public ?int $landlordNoticeMonths,
    ) {}

    /**
     * @param  array<string, mixed>  $jurisdictionData
     */
    public static function from(LeaseRegime $regime, array $jurisdictionData): self
    {
        return new self(
            $regime->defaultDurationMonths($jurisdictionData),
            $regime->minimumDurationMonths($jurisdictionData),
            $regime->maximumDurationMonths($jurisdictionData),
            $regime->tacitRenewal($jurisdictionData),
            $regime->renewalMonths($jurisdictionData),
            $regime->depositCapMonths($jurisdictionData),
            $regime->tenantNoticeMonths($jurisdictionData),
            $regime->landlordNoticeMonths($jurisdictionData),
        );
    }
}
