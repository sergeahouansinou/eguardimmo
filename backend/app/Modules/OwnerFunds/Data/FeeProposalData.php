<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Data;

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;

final readonly class FeeProposalData
{
    /**
     * Barème proposé pour une simulation, montants en unités mineures.
     */
    public function __construct(
        public FeeKind $feeKind,
        public ?int $feeBasisPoints,
        public ?int $feeFlatAmount,
        public FeeBase $feeBase,
        public int $feeMinimumAmount,
        public FeeTaxMode $feeTaxMode,
    ) {}
}
