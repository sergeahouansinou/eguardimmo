<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Modules\Mandates\Enums\MandateStatus;

final readonly class MandateCoverageData
{
    /**
     * Mandat qui couvre un lot à une date, avec les conditions en vigueur ce jour-là. Un mandat suspendu couvre toujours
     * le lot : l'appelant décide de ce qu'il autorise (`isSuspended`). Montants en unités mineures.
     *
     * @param  string  $endDate  dernier jour de couverture du lot, inclus
     */
    public function __construct(
        public string $unitId,
        public string $mandateId,
        public string $reference,
        public string $mandantPartyId,
        public MandateStatus $status,
        public bool $isSuspended,
        public string $startsOn,
        public string $endDate,
        public FeeKind $feeKind,
        public ?int $feeBasisPoints,
        public ?int $feeFlatAmount,
        public string $currency,
        public int $payoutDay,
        public int $worksLimitAmount,
        public ?FeeBase $feeBase = null,
        public int $feeMinimumAmount = 0,
        public FeeTaxMode $feeTaxMode = FeeTaxMode::ExclTax,
    ) {}
}
