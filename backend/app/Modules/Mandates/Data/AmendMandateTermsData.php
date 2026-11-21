<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;

final readonly class AmendMandateTermsData
{
    /**
     * Seules les valeurs renseignées changent ; un nouveau type d'honoraires remplace taux et forfait ensemble.
     * Montants en unités mineures de la devise du mandat.
     *
     * Les honoraires de relocation et de suivi de travaux se vident par un `*Changed` vrai avec une valeur nulle.
     *
     * @param  string  $effectiveOn  premier jour des nouvelles conditions (Y-m-d)
     */
    public function __construct(
        public int $lockVersion,
        public string $effectiveOn,
        public ?FeeKind $feeKind = null,
        public ?int $feeBasisPoints = null,
        public ?int $feeFlatAmount = null,
        public ?int $payoutDay = null,
        public ?int $worksLimitAmount = null,
        public ?FeeBase $feeBase = null,
        public ?int $feeMinimumAmount = null,
        public ?FeeTaxMode $feeTaxMode = null,
        public ?string $signedFileId = null,
        public bool $lettingFeeChanged = false,
        public ?int $lettingFeeBasisPoints = null,
        public bool $worksFeeChanged = false,
        public ?int $worksFeeBasisPoints = null,
    ) {}
}
