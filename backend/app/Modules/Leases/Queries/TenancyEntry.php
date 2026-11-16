<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Parties\Data\PartyData;

final readonly class TenancyEntry
{
    /**
     * @param  list<TenancyLine>  $leases
     */
    public function __construct(
        public PartyData $party,
        public array $leases = [],
    ) {}
}
