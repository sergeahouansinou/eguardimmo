<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Data;

use App\Modules\OwnerFunds\Enums\ExclusionReason;
use App\Modules\Parties\Data\PayoutAccountData;

final readonly class PayoutEvaluationData
{
    /**
     * @param  int  $payable  solde du compte du mandant (crédit moins débit), en unités mineures
     * @param  int  $feesDue  honoraires TTC dus : factures ouvertes et mois clos non encore facturés
     * @param  int  $feesEstimated  honoraires estimés des mois non clos
     * @param  int  $reserve  retenues partielles actives
     * @param  int  $net  net reversable, borné à zéro
     */
    public function __construct(
        public string $mandantPartyId,
        public int $payable,
        public int $inTransit,
        public int $called,
        public int $feesDue,
        public int $feesEstimated,
        public int $reserve,
        public bool $fullHold,
        public int $net,
        public ?PayoutAccountData $account,
        public ?ExclusionReason $reason,
    ) {}
}
