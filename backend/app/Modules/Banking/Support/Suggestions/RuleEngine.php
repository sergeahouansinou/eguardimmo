<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support\Suggestions;

use App\Modules\Accounting\Data\BankBookLineData;
use App\Modules\Banking\Data\SuggestionData;
use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\ExplanationCode;
use App\Modules\Banking\Enums\RuleAction;
use App\Modules\Banking\Enums\SuggestionAction;
use App\Modules\Banking\Enums\SuggestionRule;
use App\Modules\Banking\Models\BankRule;
use App\Modules\Banking\Models\BankStatementLine;
use App\Modules\Banking\Support\Text;
use Carbon\CarbonImmutable;

/**
 * Règles R1 à R6, déterministes et explicables, évaluées dans l'ordre : la première qui trouve des candidats produit la
 * proposition. Plusieurs candidats au même niveau : niveau abaissé et candidats listés. Aucune règle ne valide : elle propose.
 */
final readonly class RuleEngine
{
    private const TOKEN = '/\b(?:AV|FA|RV)-[A-Z0-9][A-Z0-9-]*/';

    public function evaluate(BankStatementLine $ligne, SuggestionContext $contexte): ?SuggestionData
    {
        $montant = (int) $ligne->amount->getAmount();

        return $this->reference($ligne, $montant, $contexte)
            ?? $this->existingEntry($ligne, $montant, $contexte)
            ?? $this->counterparty($ligne, $montant, $contexte)
            ?? $this->name($ligne, $montant, $contexte)
            ?? $this->organizationRule($ligne, $montant, $contexte)
            ?? $this->amountOnly($ligne, $montant, $contexte);
    }

    private function reference(BankStatementLine $ligne, int $montant, SuggestionContext $c): ?SuggestionData
    {
        $texte = strtoupper($ligne->label.' '.$ligne->remittance_reference);
        preg_match_all(self::TOKEN, $texte, $m);
        $jetons = array_values(array_unique($m[0]));
        $candidats = [];

        if ($ligne->direction === Direction::Credit) {
            foreach ($jetons as $jeton) {
                $echeanceId = $c->noticeNumbers[$jeton] ?? null;

                foreach ($c->installments as $echeance) {
                    if ($echeance->installmentId === $echeanceId && (int) $echeance->outstanding->getAmount() === $montant) {
                        $candidats[] = ['targets' => [['type' => 'lease', 'id' => $echeance->leaseId, 'amount' => $montant]], 'action' => SuggestionAction::SettleLease, 'code' => ExplanationCode::NoticeNumberInRemittance, 'ids' => ['installment_id' => $echeance->installmentId]];
                    }
                }

                foreach ($c->invoices as $facture) {
                    if (strtoupper($facture->number) === $jeton && (int) $facture->outstanding->getAmount() === $montant) {
                        $candidats[] = ['targets' => [['type' => 'invoice', 'id' => $facture->invoiceId, 'amount' => $montant]], 'action' => SuggestionAction::SettleInvoice, 'code' => ExplanationCode::InvoiceNumberInRemittance, 'ids' => ['invoice_id' => $facture->invoiceId]];
                    }
                }
            }
        }

        foreach ($this->entriesOf($ligne, $c, false) as $ecriture) {
            $label = strtoupper($ecriture->entryLabel);
            $code = null;

            foreach ($jetons as $jeton) {
                if (str_contains($label, $jeton)) {
                    $code = str_starts_with($jeton, 'RV-') ? ExplanationCode::PayoutNumberInRemittance : ExplanationCode::NoticeNumberInRemittance;
                }
            }

            if ($code === null && $ligne->end_to_end_id !== null && str_contains($label, strtoupper($ligne->end_to_end_id))) {
                $code = ExplanationCode::EndToEndKnown;
            }

            if ($code !== null) {
                $candidats[] = ['targets' => [['type' => 'journal_line', 'id' => $ecriture->lineId, 'amount' => $montant]], 'action' => SuggestionAction::Match, 'code' => $code, 'ids' => ['journal_line_id' => $ecriture->lineId]];
            }
        }

        return $this->build(SuggestionRule::Reference, Confidence::Exact, 100, $candidats, [ExplanationCode::AmountEqualsOutstanding]);
    }

    private function existingEntry(BankStatementLine $ligne, int $montant, SuggestionContext $c): ?SuggestionData
    {
        $candidats = [];

        foreach ($this->entriesOf($ligne, $c, true) as $ecriture) {
            $candidats[] = ['targets' => [['type' => 'journal_line', 'id' => $ecriture->lineId, 'amount' => $montant]], 'action' => SuggestionAction::Match, 'code' => ExplanationCode::AmountEqualsEntry, 'ids' => ['journal_line_id' => $ecriture->lineId]];
        }

        return $this->build(SuggestionRule::ExistingEntry, Confidence::Strong, 80, $candidats, [ExplanationCode::DateWithinWindow]);
    }

    private function counterparty(BankStatementLine $ligne, int $montant, SuggestionContext $c): ?SuggestionData
    {
        if ($ligne->direction !== Direction::Credit || $ligne->counterparty_hash === null || ! isset($c->links[$ligne->counterparty_hash])) {
            return null;
        }

        $parties = array_flip($c->links[$ligne->counterparty_hash]);

        return $this->build(SuggestionRule::KnownCounterparty, Confidence::Strong, 70, $this->outstandingCandidates($montant, $c, static fn (string $partyId): bool => isset($parties[$partyId])), [ExplanationCode::KnownCounterparty, ExplanationCode::AmountEqualsOutstanding]);
    }

    private function name(BankStatementLine $ligne, int $montant, SuggestionContext $c): ?SuggestionData
    {
        if ($ligne->direction !== Direction::Credit) {
            return null;
        }

        $libelle = ' '.Text::fold($ligne->label.' '.$ligne->counterparty_name).' ';
        $correspond = static function (string $partyId) use ($c, $libelle): bool {
            $mots = Text::words($c->partyNames[$partyId] ?? '');

            if ($mots === []) {
                return false;
            }

            foreach ($mots as $mot) {
                if (! str_contains($libelle, ' '.$mot.' ')) {
                    return false;
                }
            }

            return true;
        };

        return $this->build(SuggestionRule::Name, Confidence::Strong, 60, $this->outstandingCandidates($montant, $c, $correspond), [ExplanationCode::TenantNameInLabel, ExplanationCode::AmountEqualsOutstanding]);
    }

    private function organizationRule(BankStatementLine $ligne, int $montant, SuggestionContext $c): ?SuggestionData
    {
        foreach ($c->rules as $regle) {
            if (! $this->ruleMatches($regle, $ligne, $montant)) {
                continue;
            }

            $confiance = $regle->confidence === Confidence::Exact ? Confidence::Strong : $regle->confidence;
            $codes = [ExplanationCode::OrganizationRule->value];
            $ids = ['rule_id' => $regle->id];

            if ($regle->action === RuleAction::SuggestLease && $regle->target_lease_id !== null && $ligne->direction === Direction::Credit) {
                return new SuggestionData(SuggestionRule::OrganizationRule, $confiance, 50, SuggestionAction::SettleLease, [['type' => 'lease', 'id' => $regle->target_lease_id, 'amount' => $montant]], $codes, $ids);
            }

            if ($regle->action === RuleAction::SuggestBankCharges && $ligne->direction === Direction::Debit) {
                return new SuggestionData(SuggestionRule::OrganizationRule, $confiance, 50, SuggestionAction::BankCharges, [], $codes, $ids);
            }

            if ($regle->action === RuleAction::SuggestIgnore && $regle->ignore_reason !== null) {
                return new SuggestionData(SuggestionRule::OrganizationRule, $confiance, 50, SuggestionAction::Ignore, [], $codes, [...$ids, 'ignore_reason' => $regle->ignore_reason->value]);
            }
        }

        return null;
    }

    private function amountOnly(BankStatementLine $ligne, int $montant, SuggestionContext $c): ?SuggestionData
    {
        $candidats = [];

        if ($ligne->direction === Direction::Credit) {
            $candidats = $this->outstandingCandidates($montant, $c, static fn (string $partyId): bool => true);
        }

        foreach ($c->bookLines as $ecriture) {
            if ($ecriture->side === $ligne->direction->ledgerSide() && (int) $ecriture->amount->getAmount() === $montant) {
                $candidats[] = ['targets' => [['type' => 'journal_line', 'id' => $ecriture->lineId, 'amount' => $montant]], 'action' => SuggestionAction::Match, 'code' => ExplanationCode::AmountEqualsEntry, 'ids' => ['journal_line_id' => $ecriture->lineId]];
            }
        }

        return $this->build(SuggestionRule::AmountOnly, Confidence::Weak, 30, $candidats, []);
    }

    /**
     * @param  list<array{targets: list<array{type: string, id: string, amount: int}>, action: SuggestionAction, code: ExplanationCode, ids: array<string, mixed>}>  $candidats
     * @param  list<ExplanationCode>  $codesCommuns
     */
    private function build(SuggestionRule $regle, Confidence $niveau, int $score, array $candidats, array $codesCommuns): ?SuggestionData
    {
        if ($candidats === []) {
            return null;
        }

        $uniques = [];

        foreach ($candidats as $candidat) {
            $uniques[implode(',', array_map(static fn (array $t): string => $t['type'].':'.$t['id'], $candidat['targets']))] = $candidat;
        }

        $uniques = array_values($uniques);
        $ambigu = count($uniques) > 1;
        $codes = array_map(static fn (ExplanationCode $code): string => $code->value, [...array_column($uniques, 'code'), ...$codesCommuns]);

        if ($ambigu) {
            $codes[] = ExplanationCode::Ambiguous->value;
        }

        $ids = [];

        foreach ($uniques as $candidat) {
            foreach ($candidat['ids'] as $cle => $valeur) {
                $ids[$cle][] = $valeur;
            }
        }

        $cibles = [];

        foreach ($uniques as $candidat) {
            if ($candidat['action'] === $uniques[0]['action']) {
                array_push($cibles, ...$candidat['targets']);
            }
        }

        return new SuggestionData(
            $regle, $ambigu ? $niveau->lowered() : $niveau, $score - ($ambigu ? 10 : 0), $uniques[0]['action'], $cibles, array_values(array_unique($codes)), $ids,
        );
    }

    /**
     * Candidats dont le reste dû égale le montant : un bail (reste dû d'une échéance ou du bail entier), une facture, ou la somme des baux d'une même partie.
     *
     * @param  callable(string): bool  $partie
     * @return list<array{targets: list<array{type: string, id: string, amount: int}>, action: SuggestionAction, code: ExplanationCode, ids: array<string, mixed>}>
     */
    private function outstandingCandidates(int $montant, SuggestionContext $c, callable $partie): array
    {
        $baux = [];
        $parPartie = [];

        foreach ($c->installments as $echeance) {
            if ($echeance->partyId === null || ! $partie($echeance->partyId)) {
                continue;
            }

            $reste = (int) $echeance->outstanding->getAmount();
            $baux[$echeance->leaseId]['total'] = ($baux[$echeance->leaseId]['total'] ?? 0) + $reste;
            $baux[$echeance->leaseId]['echeances'][] = $reste;
            $parPartie[$echeance->partyId][$echeance->leaseId] = true;
        }

        $candidats = [];

        foreach ($baux as $bailId => $reste) {
            if ($reste['total'] === $montant || in_array($montant, $reste['echeances'], true)) {
                $candidats[] = ['targets' => [['type' => 'lease', 'id' => $bailId, 'amount' => $montant]], 'action' => SuggestionAction::SettleLease, 'code' => ExplanationCode::AmountEqualsOutstanding, 'ids' => ['lease_id' => $bailId]];
            }
        }

        if ($candidats === []) {
            foreach ($parPartie as $bauxDePartie) {
                $ids = array_keys($bauxDePartie);

                if (count($ids) > 1 && array_sum(array_map(static fn (string $id): int => $baux[$id]['total'], $ids)) === $montant) {
                    $candidats[] = [
                        'targets' => array_map(static fn (string $id): array => ['type' => 'lease', 'id' => $id, 'amount' => $baux[$id]['total']], $ids),
                        'action' => SuggestionAction::SettleLease, 'code' => ExplanationCode::AmountEqualsOutstanding, 'ids' => ['lease_ids' => $ids],
                    ];

                    break;
                }
            }
        }

        foreach ($c->invoices as $facture) {
            if ($partie($facture->partyId) && (int) $facture->outstanding->getAmount() === $montant) {
                $candidats[] = ['targets' => [['type' => 'invoice', 'id' => $facture->invoiceId, 'amount' => $montant]], 'action' => SuggestionAction::SettleInvoice, 'code' => ExplanationCode::AmountEqualsOutstanding, 'ids' => ['invoice_id' => $facture->invoiceId]];
            }
        }

        return $candidats;
    }

    /**
     * @return list<BankBookLineData>
     */
    private function entriesOf(BankStatementLine $ligne, SuggestionContext $c, bool $dansFenetre): array
    {
        $montant = (int) $ligne->amount->getAmount();
        $jour = CarbonImmutable::parse($ligne->booking_date->toDateString());
        $debut = $jour->subDays((int) config('banking.match_window_days'))->toDateString();
        $fin = $jour->addDays((int) config('banking.match_window_after_days'))->toDateString();

        return array_values(array_filter($c->bookLines, static fn (BankBookLineData $e): bool => $e->side === $ligne->direction->ledgerSide()
            && (int) $e->amount->getAmount() === $montant
            && (! $dansFenetre || ($e->entryDate >= $debut && $e->entryDate <= $fin))));
    }

    private function ruleMatches(BankRule $regle, BankStatementLine $ligne, int $montant): bool
    {
        return ($regle->direction === null || $regle->direction === $ligne->direction)
            && ($regle->amount_min === null || $montant >= $regle->amount_min)
            && ($regle->amount_max === null || $montant <= $regle->amount_max)
            && ($regle->transaction_code === null || $regle->transaction_code === $ligne->transaction_code)
            && ($regle->counterparty_hash === null || $regle->counterparty_hash === $ligne->counterparty_hash)
            && ($regle->label_contains === null || str_contains(Text::fold($ligne->label), Text::fold($regle->label_contains)));
    }
}
