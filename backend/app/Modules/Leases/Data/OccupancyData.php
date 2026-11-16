<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class OccupancyData
{
    /**
     * @param  string  $validFrom  Y-m-d, début de l'occupation du lot par le bail
     * @param  ?string  $validTo  Y-m-d, exclu
     */
    public function __construct(
        public string $unitId,
        public string $leaseId,
        public string $leaseReference,
        public bool $isMain,
        public string $validFrom,
        public ?string $validTo,
    ) {}
}
