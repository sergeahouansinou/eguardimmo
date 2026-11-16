<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class NewLeaseUnitChangeData
{
    /**
     * @param  string  $validFrom  Y-m-d, début d'occupation du lot dans le bail
     */
    public function __construct(
        public int $lockVersion,
        public string $unitId,
        public bool $isMain,
        public string $validFrom,
    ) {}
}
