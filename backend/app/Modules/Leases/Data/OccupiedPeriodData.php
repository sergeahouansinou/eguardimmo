<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class OccupiedPeriodData
{
    /**
     * @param  string  $from  Y-m-d, début effectif de l'occupation du lot par le bail
     * @param  ?string  $to  Y-m-d, exclu ; null : occupation ouverte
     */
    public function __construct(
        public string $unitId,
        public string $leaseId,
        public string $from,
        public ?string $to,
    ) {}
}
