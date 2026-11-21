<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Data;

use Carbon\CarbonImmutable;

final readonly class FeePlanItemData
{
    /**
     * @param  CarbonImmutable  $periodStart  premier jour du mois
     * @param  CarbonImmutable  $periodEnd  premier jour du mois suivant (exclu)
     * @param  int  $carriedIn  avoir reporté des mois précédents (positif)
     * @param  int  $adjustedNet  honoraires du mois moins le report : positif, une facture ; négatif, un avoir ; nul, rien
     * @param  int  $adjustedGross  TTC de la facture à émettre (0 sinon)
     */
    public function __construct(
        public string $mandateId,
        public string $mandateReference,
        public string $mandantPartyId,
        public CarbonImmutable $periodStart,
        public CarbonImmutable $periodEnd,
        public FeeResultData $result,
        public int $carriedIn,
        public int $adjustedNet,
        public int $adjustedGross,
    ) {}
}
