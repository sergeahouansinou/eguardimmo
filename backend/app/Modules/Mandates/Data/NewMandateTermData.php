<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;

final readonly class NewMandateTermData
{
    /**
     * Montants en unités mineures de la devise du mandat.
     */
    public function __construct(
        public FeeKind $feeKind,
        public ?int $feeBasisPoints,
        public ?int $feeFlatAmount,
        public int $payoutDay,
        public int $worksLimitAmount,
        public ?FeeBase $feeBase = null,
        public int $feeMinimumAmount = 0,
        public FeeTaxMode $feeTaxMode = FeeTaxMode::ExclTax,
        public ?int $lettingFeeBasisPoints = null,
        public ?int $worksFeeBasisPoints = null,
        public ?string $signedFileId = null,
    ) {}
}
