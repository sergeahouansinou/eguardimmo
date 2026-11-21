<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExpenseSettlement;
use App\Modules\Charges\Models\Expense;
use Money\Currency;
use Money\Money;

/**
 * Écriture d'une dépense et règles des fonds de tiers (ADR 0031 § 7 et § 14) : verrou du compte mandant avant toute lecture de son solde.
 */
final readonly class ExpenseLedger
{
    public function __construct(
        private Ledger $livre,
        private LedgerReader $soldes,
        private LedgerAggregates $agregats,
        private ExpensePostings $ecritures,
    ) {}

    /**
     * @return string identifiant de l'écriture
     */
    public function post(Expense $depense, string $categoryKey): string
    {
        $monnaie = Currencies::of($depense->currency);

        if ($depense->settlement->movesThirdPartyFunds() && $depense->mandant_party_id !== null) {
            $this->livre->lockParty($depense->mandant_party_id);
        }

        if ($depense->settlement === ExpenseSettlement::Trust) {
            $this->assertTrustFunds($depense, $monnaie);
        }

        return $this->livre->post($this->ecritures->post($depense, $categoryKey))->id;
    }

    /**
     * Au-delà du seuil, une autre personne habilitée doit valider, quelle que soit la taille de l'équipe au moment de la saisie : la dépense
     * reste en attente tant qu'un second membre ne l'a pas validée.
     */
    public function needsSecondApproval(ExpenseSettlement $mode, int $montant): bool
    {
        return $mode === ExpenseSettlement::Trust && $montant > (int) config('charges.third_party_second_approval_minor');
    }

    private function assertTrustFunds(Expense $depense, Currency $monnaie): void
    {
        $mandant = (string) $depense->mandant_party_id;

        if ($this->soldes->ownerFundsCutoverAt() === null) {
            throw ErrorCode::OwnerFundsInsufficient->problem('Les fonds des mandants ne sont pas activés : réglez en avance sur fonds propres.');
        }

        if (! $this->agregats->trustCoverage($monnaie)->covered) {
            throw ErrorCode::TrustFundsGap->problem('Le compte de tiers ne couvre pas ce que l\'agence doit aux mandants et aux locataires : réglez en avance sur fonds propres ou résorbez l\'écart.');
        }

        $solde = $this->agregats->ownerFunds([$mandant], $monnaie)[$mandant]->payable ?? new Money(0, $monnaie);

        if ($solde->subtract($depense->total_gross)->isNegative()) {
            throw ErrorCode::OwnerFundsInsufficient->problem('Le solde du mandant ne couvre pas cette dépense : réglez-la en avance sur fonds propres ou attendez un encaissement.');
        }
    }
}
