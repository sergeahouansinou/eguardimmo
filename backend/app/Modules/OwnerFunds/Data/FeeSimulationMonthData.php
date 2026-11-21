<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Data;

final readonly class FeeSimulationMonthData
{
    /**
     * @param  string  $month  AAAA-MM
     * @param  FeeAmountsData|null  $current  nul si le barème en vigueur n'a pas de base d'honoraires
     */
    public function __construct(
        public string $month,
        public int $baseRent,
        public int $baseCharges,
        public ?FeeAmountsData $current,
        public FeeAmountsData $simulated,
    ) {}
}
