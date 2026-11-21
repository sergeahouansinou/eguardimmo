<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;

final readonly class MandateFeeTermData
{
    /**
     * Barème en vigueur sur [validFrom, validTo) ; `validTo` nul pour le terme ouvert. Montants en unités mineures.
     */
    public function __construct(
        public string $id,
        public string $validFrom,
        public ?string $validTo,
        public FeeKind $feeKind,
        public ?int $feeBasisPoints,
        public ?int $feeFlatAmount,
        public ?FeeBase $feeBase,
        public int $feeMinimumAmount,
        public FeeTaxMode $feeTaxMode,
        public ?int $payoutDay = null,
    ) {}
}
