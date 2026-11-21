<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

final readonly class LinkedPartyData
{
    public function __construct(
        public string $organizationId,
        public string $partyId,
    ) {}
}
