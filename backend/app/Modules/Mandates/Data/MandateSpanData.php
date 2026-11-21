<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Modules\Mandates\Enums\MandateStatus;

final readonly class MandateSpanData
{
    /**
     * Couverture d'un lot par un mandat sur une partie d'une période, avec les conditions en vigueur le dernier jour de la couverture.
     *
     * @param  string  $from  premier jour couvert, inclus
     * @param  string  $to  dernier jour couvert, inclus
     */
    public function __construct(
        public string $mandateId,
        public string $reference,
        public string $mandantPartyId,
        public string $unitId,
        public string $from,
        public string $to,
        public MandateStatus $status,
        public FeeKind $feeKind,
        public ?int $feeBasisPoints,
        public ?int $feeFlatAmount,
        public ?FeeBase $feeBase,
        public int $feeMinimumAmount,
        public FeeTaxMode $feeTaxMode,
        public string $currency,
    ) {}
}
