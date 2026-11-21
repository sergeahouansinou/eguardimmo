<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Data;

use App\Modules\Mandates\Data\MandateFeeTermData;

final readonly class FeeResultData
{
    /**
     * @param  int  $net  honoraires hors taxe, signés
     * @param  int  $tax  taxe, signée
     * @param  int  $gross  net + taxe
     * @param  list<string>  $termIds  barèmes utilisés dans le mois
     */
    public function __construct(
        public int $baseRent,
        public int $baseCharges,
        public int $net,
        public int $tax,
        public int $gross,
        public bool $minimumApplied,
        public array $termIds,
        public ?MandateFeeTermData $term,
    ) {}
}
