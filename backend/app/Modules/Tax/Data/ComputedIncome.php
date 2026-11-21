<?php

declare(strict_types=1);

namespace App\Modules\Tax\Data;

final readonly class ComputedIncome
{
    /**
     * @param  list<string>  $loanIds  prêts dont les montants servent à la synthèse
     * @param  string  $ledgerCutoff  version du grand livre au moment du calcul
     */
    public function __construct(
        public RentalIncomeData $income,
        public array $loanIds,
        public string $ledgerCutoff,
        public ?string $holderName = null,
    ) {}
}
