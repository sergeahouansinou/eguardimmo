<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Modules\Accounting\Data\MovementData;
use App\Modules\Accounting\Data\PartyStatementData;
use App\Modules\Accounting\Data\PartyStatementLineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Mandates\Data\MandateSpanData;
use App\Modules\Reporting\Data\LedgerFigures;
use App\Modules\Reporting\Data\ReportLineInput;
use App\Modules\Reporting\Data\ReportPeriod;
use App\Modules\Reporting\Enums\LineDirection;
use App\Modules\Reporting\Enums\LineKind;
use LogicException;
use Money\Currency;
use Money\Money;

/**
 * Toutes les lectures du grand livre d'un compte rendu : appels par lot et par mois, compte du mandant (`OwnerPayable`),
 * TVA des honoraires et reversements exécutés. Aucun montant ne vient d'ailleurs (ADR 0030, décision 1).
 */
final readonly class FiguresReader
{
    private const array APPELES = [AccountRole::OwnerRentCalled, AccountRole::OwnerChargesCalled, AccountRole::OwnerVatCalled];

    public function __construct(private LedgerAggregates $grandLivre) {}

    /**
     * @param  list<MandateSpanData>  $spans
     * @param  array<string, string>  $unitReferences
     */
    public function read(string $mandantId, Currency $devise, ReportPeriod $periode, array $spans, array $unitReferences): LedgerFigures
    {
        $compte = $this->grandLivre->partyStatement($mandantId, AccountRole::OwnerPayable, $devise, $periode->from, $periode->to);
        $tva = $this->grandLivre->partyStatement($mandantId, AccountRole::VatCollected, $devise, $periode->from, $periode->to);
        $transit = $this->grandLivre->partyStatement($mandantId, AccountRole::PayoutsInTransit, $devise, $periode->from, $periode->to);
        $appels = $this->grandLivre->movements(self::APPELES, $devise, $periode->from, $periode->to, [$mandantId], null, [SourceType::Installment]);

        $lignes = [...$this->appeles($appels, $periode, $spans, $unitReferences), ...$this->comptabilises($compte, $this->tvaParEcriture($tva), $spans)];
        $totaux = ['collected' => 0, 'fees' => 0, 'works' => 0, 'payout' => 0, 'adjustments' => 0];

        foreach ($lignes as $l) {
            $signe = $l->direction === LineDirection::Credit ? 1 : -1;

            match ($l->kind) {
                LineKind::RentCollected, LineKind::Advance => $totaux['collected'] += $signe * $l->amount,
                LineKind::Fee, LineKind::FeeVat => $totaux['fees'] -= $signe * $l->amount,
                LineKind::Works => $totaux['works'] -= $signe * $l->amount,
                LineKind::Payout => $totaux['payout'] -= $signe * $l->amount,
                LineKind::Adjustment => $totaux['adjustments'] += $signe * $l->amount,
                default => null,
            };
        }

        $ouverture = $this->entier($compte->opening);
        $cloture = $this->entier($compte->closing);

        if ($ouverture + $totaux['collected'] - $totaux['fees'] - $totaux['works'] - $totaux['payout'] + $totaux['adjustments'] !== $cloture) {
            throw new LogicException('Le compte rendu ne se réconcilie pas avec le compte du mandant.');
        }

        return new LedgerFigures(
            $ouverture, $cloture, $totaux['collected'], $totaux['fees'], $totaux['works'], $totaux['payout'], $totaux['adjustments'],
            $this->entier($transit->closing), $lignes, $this->executions($transit),
        );
    }

    /**
     * @param  list<MovementData>  $mouvements
     * @param  list<MandateSpanData>  $spans
     * @param  array<string, string>  $unitReferences
     * @return list<ReportLineInput>
     */
    private function appeles(array $mouvements, ReportPeriod $periode, array $spans, array $unitReferences): array
    {
        $parLotEtMois = [];

        foreach ($mouvements as $m) {
            $cle = ($m->unitId ?? '').'|'.$m->month;
            $parLotEtMois[$cle] = ($parLotEtMois[$cle] ?? 0) + $this->entier($m->credit) - $this->entier($m->debit);
        }

        ksort($parLotEtMois);
        $lignes = [];

        foreach ($parLotEtMois as $cle => $net) {
            [$lot, $mois] = explode('|', $cle);

            if ($net === 0 || $lot === '') {
                continue;
            }

            $premier = $mois.'-01';
            $date = $premier < $periode->from->toDateString() ? $periode->from->toDateString() : $premier;
            $lignes[] = (new ReportLineInput(
                LineKind::RentCalled, $date, $lot, null, null, 'Loyers et charges appelés, lot '.($unitReferences[$lot] ?? $lot).', '.$mois,
                abs($net), $net > 0 ? LineDirection::Credit : LineDirection::Debit, SourceType::Installment->value, null,
            ))->withMandate($this->mandat($spans, $lot, $date));
        }

        return $lignes;
    }

    /**
     * @param  array<string, int>  $tva  TVA des honoraires par écriture : crédit − débit de `VatCollected`
     * @param  list<MandateSpanData>  $spans
     * @return list<ReportLineInput>
     */
    private function comptabilises(PartyStatementData $compte, array $tva, array $spans): array
    {
        $lignes = [];

        foreach ($compte->lines as $l) {
            $montant = $this->entier($l->credit) > 0 ? $this->entier($l->credit) : $this->entier($l->debit);
            $sens = $this->entier($l->credit) > 0 ? LineDirection::Credit : LineDirection::Debit;
            $genre = $this->genre($l);
            $mandat = $l->unitId === null ? null : $this->mandat($spans, $l->unitId, $l->date->toDateString());

            if ($genre !== LineKind::Fee) {
                $lignes[] = new ReportLineInput($genre, $l->date->toDateString(), $l->unitId, $l->leaseId, $mandat, $l->label, $montant, $sens, $l->source->value, $l->sourceId);

                continue;
            }

            $taxe = min(abs($tva[$l->entryId] ?? 0), $montant);
            $lignes[] = new ReportLineInput(LineKind::Fee, $l->date->toDateString(), $l->unitId, $l->leaseId, $mandat, $l->label, $montant - $taxe, $sens, $l->source->value, $l->sourceId);

            if ($taxe > 0) {
                $lignes[] = new ReportLineInput(LineKind::FeeVat, $l->date->toDateString(), $l->unitId, $l->leaseId, $mandat, 'TVA sur honoraires', $taxe, $sens, $l->source->value, $l->sourceId);
            }
        }

        return array_values(array_filter($lignes, fn (ReportLineInput $l): bool => $l->amount > 0));
    }

    private function genre(PartyStatementLineData $ligne): LineKind
    {
        return match ($ligne->source) {
            SourceType::Payment => $this->reglementDHonoraires($ligne) ? LineKind::Fee : ($ligne->unitId === null ? LineKind::Advance : LineKind::RentCollected),
            SourceType::FeeSettlement, SourceType::CreditNote, SourceType::Invoice => LineKind::Fee,
            SourceType::SupplierAllocation => LineKind::Works,
            SourceType::OwnerPayout => LineKind::Payout,
            default => LineKind::Adjustment,
        };
    }

    /**
     * Le règlement d'une facture d'honoraires prélevé sur le compte du mandant est une écriture `payment` qui débite ce
     * compte ; son extourne le crédite. Un encaissement de loyer fait l'inverse.
     */
    private function reglementDHonoraires(PartyStatementLineData $ligne): bool
    {
        return $ligne->debit->isPositive() !== $ligne->isReversal;
    }

    /**
     * @return array<string, int>
     */
    private function tvaParEcriture(PartyStatementData $tva): array
    {
        $parEcriture = [];

        foreach ($tva->lines as $l) {
            $parEcriture[$l->entryId] = ($parEcriture[$l->entryId] ?? 0) + $this->entier($l->credit) - $this->entier($l->debit);
        }

        return $parEcriture;
    }

    /**
     * @return list<array{date: string, amount: int, reference: string}>
     */
    private function executions(PartyStatementData $transit): array
    {
        $executions = [];

        foreach ($transit->lines as $l) {
            if ($l->source !== SourceType::OwnerPayout) {
                continue;
            }

            if ($l->debit->isPositive() && ! $l->isReversal) {
                $executions[] = ['date' => $l->date->toDateString(), 'amount' => $this->entier($l->debit), 'reference' => $l->reference];
            } elseif ($l->credit->isPositive() && $l->isReversal) {
                $executions[] = ['date' => $l->date->toDateString(), 'amount' => -$this->entier($l->credit), 'reference' => $l->reference];
            }
        }

        return $executions;
    }

    /**
     * @param  list<MandateSpanData>  $spans
     */
    private function mandat(array $spans, string $lot, string $date): ?string
    {
        $candidat = null;

        foreach ($spans as $s) {
            if ($s->unitId !== $lot) {
                continue;
            }

            $candidat ??= $s->mandateId;

            if ($s->from <= $date && $date <= $s->to) {
                return $s->mandateId;
            }
        }

        return $candidat;
    }

    private function entier(Money $montant): int
    {
        return (int) $montant->getAmount();
    }
}
