<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use Money\Money;

final readonly class TrustCoverageData
{
    /**
     * Équation de cantonnement (ADR 0031, décision 7) : `trustBank >= required`. `surplus` = `trustBank - required` ;
     * négatif, c'est un écart. Seuls les comptes mandants créditeurs entrent dans `ownerPayable`.
     */
    public function __construct(
        public Money $trustBank,
        public Money $ownerPayable,
        public Money $payoutsInTransit,
        public Money $securityDeposits,
        public Money $advances,
        public Money $required,
        public Money $surplus,
        public bool $covered,
    ) {}
}
