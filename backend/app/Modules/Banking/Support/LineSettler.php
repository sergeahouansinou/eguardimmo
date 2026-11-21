<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\OnClosedPeriod;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\BankBook;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\MatchKind;
use App\Modules\Banking\Enums\SuggestionAction;
use App\Modules\Banking\Enums\SuggestionRule;
use App\Modules\Banking\Models\BankMatch;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Invoicing\Data\BankInvoiceTransferData;
use App\Modules\Invoicing\PublicApi\InvoiceSettlements;
use App\Modules\Rent\Data\BankTransferData;
use App\Modules\Rent\PublicApi\RentCollections;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Money\Currency;
use Money\Money;

/**
 * Crée l'écriture d'une ligne de relevé par l'Action du module qui la porte (encaissement de loyer, règlement de facture,
 * frais bancaires), puis pointe la ligne d'écriture produite (`settled`). La ligne de relevé est déjà verrouillée ; échec = retour arrière.
 */
final readonly class LineSettler
{
    public function __construct(
        private RentCollections $loyers,
        private InvoiceSettlements $factures,
        private Ledger $livre,
        private BankBook $banque,
        private MatchWriter $ecriture,
    ) {}

    /**
     * @param  list<array{id: string, amount: int}>  $cibles  baux (un montant par bail) ou facture ; vide pour des frais bancaires
     * @param  array<string, mixed>|null  $explication
     */
    public function settle(
        BankStatementLine $ligne,
        OrganizationBankAccount $compte,
        SuggestionAction $action,
        array $cibles,
        string $userId,
        ?SuggestionRule $regle = null,
        ?array $explication = null,
    ): BankMatch {
        $montant = (int) $ligne->amount->getAmount();
        $devise = new Currency($compte->currency);
        $jour = $ligne->booking_date->toDateString();
        $attendu = $action === SuggestionAction::BankCharges ? Direction::Debit : Direction::Credit;

        if ($ligne->direction !== $attendu) {
            throw ErrorCode::LineNotMatchable->problem();
        }

        $ecritures = match ($action) {
            SuggestionAction::SettleLease => $this->loyers($ligne, $cibles, $montant, $jour),
            SuggestionAction::SettleInvoice => $this->facture($ligne, $cibles, $jour),
            SuggestionAction::BankCharges => [$this->frais($ligne, $compte, new Money($montant, $devise))],
            default => throw ErrorCode::LineNotMatchable->problem(),
        };

        $lignesLivre = $this->banque->ofEntries($compte->ledger_role->accountRole(), $devise, $ecritures);
        $lignesLivre = array_values(array_filter($lignesLivre, static fn ($l): bool => $l->side === $ligne->direction->ledgerSide()));

        return $this->ecriture->write($compte->id, MatchKind::Settled, [$ligne], $lignesLivre, $userId, $regle, null, $explication);
    }

    /**
     * @param  list<array{id: string, amount: int}>  $cibles
     * @return list<string> identifiants d'écritures
     */
    private function loyers(BankStatementLine $ligne, array $cibles, int $montant, string $jour): array
    {
        if ($cibles === [] || array_sum(array_column($cibles, 'amount')) !== $montant) {
            throw ErrorCode::MatchUnbalanced->problem();
        }

        $ecritures = [];
        $soldees = [];

        foreach ($cibles as $i => $cible) {
            $resultat = $this->loyers->recordBankTransfer(
                new BankTransferData($cible['id'], $cible['amount'], $jour, $ligne->bank_reference, "banking:line:{$ligne->id}:{$i}"),
                CarbonImmutable::today(),
            );
            $ecritures[] = $resultat->ledgerEntryId;
            $soldees = [...$soldees, ...$resultat->settledInstallmentIds];
        }

        if ($soldees !== []) {
            DB::afterCommit(fn () => $this->loyers->issueReceipts($soldees, CarbonImmutable::today()));
        }

        return $ecritures;
    }

    /**
     * @param  list<array{id: string, amount: int}>  $cibles
     * @return list<string>
     */
    private function facture(BankStatementLine $ligne, array $cibles, string $jour): array
    {
        if (count($cibles) !== 1) {
            throw ErrorCode::MatchUnbalanced->problem();
        }

        $resultat = $this->factures->recordBankTransfer(
            new BankInvoiceTransferData($cibles[0]['id'], $cibles[0]['amount'], $jour, $ligne->bank_reference, "banking:line:{$ligne->id}:0"),
            CarbonImmutable::today(),
        );

        return [$resultat->ledgerEntryId];
    }

    private function frais(BankStatementLine $ligne, OrganizationBankAccount $compte, Money $montant): string
    {
        $ecriture = $this->livre->post(new EntryData(
            Journal::Bank,
            CarbonImmutable::parse($ligne->booking_date->toDateString()),
            'Frais bancaires',
            SourceType::BankLine,
            $ligne->id,
            "banking:line:{$ligne->id}:charges",
            [LineData::debit(AccountRole::BankCharges, $montant), LineData::credit($compte->ledger_role->accountRole(), $montant)],
            OnClosedPeriod::RollForward,
        ));

        return $ecriture->id;
    }
}
