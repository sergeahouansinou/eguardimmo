<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Data;

final readonly class FeeAmountsData
{
    /**
     * @param  string  $source  `statement` (relevé posé) ou `computed` (calculé au barème en vigueur) ; `simulation` pour la proposition
     */
    public function __construct(
        public string $source,
        public int $net,
        public int $tax,
        public int $gross,
        public bool $minimumApplied,
    ) {}
}
