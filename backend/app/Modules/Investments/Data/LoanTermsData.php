<?php

declare(strict_types=1);

namespace App\Modules\Investments\Data;

use App\Modules\Investments\Enums\DeferralKind;
use App\Modules\Investments\Enums\InsuranceMode;

final readonly class LoanTermsData
{
    /**
     * @param  int  $principal  unités mineures
     * @param  string  $annualRate  taux nominal annuel en %, décimal en chaîne (« 3.50000 »)
     * @param  string  $firstDueOn  Y-m-d
     * @param  int  $termMonths  nombre total d'échéances, différé compris
     * @param  string|null  $insuranceRate  % annuel, pour les modes `initial_capital` et `outstanding_capital`
     * @param  int|null  $insuranceAmount  unités mineures par échéance, pour le mode `fixed`
     */
    public function __construct(
        public int $principal,
        public string $annualRate,
        public string $firstDueOn,
        public int $termMonths,
        public DeferralKind $deferralKind,
        public int $deferralMonths,
        public InsuranceMode $insuranceMode,
        public ?string $insuranceRate,
        public ?int $insuranceAmount,
    ) {}
}
