<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Data;

use App\Modules\Mandates\Data\MandateFeeTermData;

final readonly class FeeSegmentData
{
    /**
     * Encaissements imputés (nets des contrepassations) d'un mois sous un même barème, en unités mineures.
     */
    public function __construct(
        public MandateFeeTermData $term,
        public int $rent,
        public int $charges,
    ) {}
}
