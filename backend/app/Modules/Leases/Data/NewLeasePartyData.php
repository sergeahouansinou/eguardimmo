<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Enums\LeasePartyRole;

final readonly class NewLeasePartyData
{
    /**
     * @param  ?int  $guaranteeLimitAmount  unités mineures, dans la devise du bail
     * @param  ?string  $guaranteeEndsOn  Y-m-d
     */
    public function __construct(
        public string $partyId,
        public LeasePartyRole $role,
        public bool $jointLiability = false,
        public ?string $guaranteesPartyId = null,
        public ?int $guaranteeLimitAmount = null,
        public ?string $guaranteeEndsOn = null,
    ) {}
}
