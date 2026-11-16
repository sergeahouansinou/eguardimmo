<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Leases\Enums\LeasePartyRole;

final readonly class NewLeasePartyChangeData
{
    /**
     * @param  ?string  $validFrom  Y-m-d ; absent : aujourd'hui, borné au début du bail
     * @param  ?int  $guaranteeLimitAmount  unités mineures, dans la devise du bail
     * @param  ?string  $guaranteeEndsOn  Y-m-d
     */
    public function __construct(
        public int $lockVersion,
        public string $partyId,
        public LeasePartyRole $role,
        public bool $jointLiability = false,
        public ?string $validFrom = null,
        public ?string $guaranteesPartyId = null,
        public ?int $guaranteeLimitAmount = null,
        public ?string $guaranteeEndsOn = null,
    ) {}
}
