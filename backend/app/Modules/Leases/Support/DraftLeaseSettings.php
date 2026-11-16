<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Jurisdictions\LeaseRegime;

final readonly class DraftLeaseSettings
{
    /**
     * @param  array<string, mixed>  $jurisdictionData  validées par le régime
     * @param  string  $endsOn  Y-m-d, exclu
     */
    public function __construct(
        public LeaseRegime $regime,
        public array $jurisdictionData,
        public int $durationMonths,
        public bool $tacitRenewal,
        public string $endsOn,
    ) {}
}
