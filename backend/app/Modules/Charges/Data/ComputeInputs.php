<?php

declare(strict_types=1);

namespace App\Modules\Charges\Data;

use App\Modules\Rent\Data\LeaseProvisionsData;
use Carbon\CarbonImmutable;

final readonly class ComputeInputs
{
    /**
     * @param  array<string, array<string, int>>  $daysByLeaseUnit  jours occupés par bail concerné, puis par lot
     * @param  array<string, int>  $unionDaysByLease  jours où le bail occupe au moins un lot
     * @param  array<string, LeaseProvisionsData>  $provisions  un bail sans provision appelée est absent
     * @param  array<string, array{mandate: string|null, mandant: string|null}>  $mandants
     * @param  list<string>  $occupiedUnitIds  lots occupés par un bail concerné
     * @param  list<array{lease_id: string, reason: string}>  $excluded  baux écartés : forfait ou aucune provision
     */
    public function __construct(
        public CarbonImmutable $start,
        public CarbonImmutable $end,
        public int $periodDays,
        public array $daysByLeaseUnit,
        public array $unionDaysByLease,
        public array $provisions,
        public array $mandants,
        public array $occupiedUnitIds,
        public array $excluded,
    ) {}
}
