<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class TenantLeaseKeyData
{
    /**
     * @param  ?string  $exitedOn  sortie (Y-m-d, semi-ouverte) de la ligne du compte sur ce bail ; null tant qu'il occupe
     */
    public function __construct(
        public string $organizationId,
        public string $leaseId,
        public ?string $exitedOn = null,
    ) {}
}
