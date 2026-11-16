<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Enums\LeasePartyRole;
use Money\Money;

final readonly class LeasePartyData
{
    /**
     * @param  string  $validFrom  Y-m-d
     * @param  ?string  $validTo  Y-m-d, exclu : la date de départ ferme la ligne
     * @param  ?string  $guaranteeEndsOn  Y-m-d
     */
    public function __construct(
        public string $id,
        public string $leaseId,
        public string $partyId,
        public LeasePartyRole $role,
        public bool $jointLiability,
        public ?string $guaranteesPartyId,
        public ?Money $guaranteeLimit,
        public ?string $guaranteeEndsOn,
        public string $validFrom,
        public ?string $validTo,
    ) {}
}
