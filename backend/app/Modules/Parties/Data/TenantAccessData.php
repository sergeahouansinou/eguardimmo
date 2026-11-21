<?php

declare(strict_types=1);

namespace App\Modules\Parties\Data;

use Carbon\CarbonImmutable;

final readonly class TenantAccessData
{
    /**
     * @param  'none'|'invited'|'linked'  $status
     */
    public function __construct(
        public string $partyId,
        public string $status,
        public ?string $emailHint,
        public ?CarbonImmutable $expiresAt,
        public ?CarbonImmutable $linkedAt,
    ) {}
}
