<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Accounting\Data\AccountingPeriodData;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Invoicing\Data\FeeInvoiceRequestData;
use App\Modules\Invoicing\PublicApi\ManagementFeeInvoices;
use App\Modules\Mandates\Data\MandateFeeScheduleData;
use App\Modules\Mandates\Data\MandateFeeTermData;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Data\FeePlanItemData;
use App\Modules\OwnerFunds\Data\FeeSegmentData;
use App\Modules\OwnerFunds\Models\FeeStatement;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Money\Currency;
use Money\Money;

/**
 * Facturation mensuelle des honoraires de gestion (ADR 0031, décision 3) : un relevé par mandat et par mois clos,
 * facturé par le serveur. Les mois antérieurs au mois d'activation restent ceux des factures saisies à la main.
 */
final readonly class FeeBilling
{
    private const int DIVISEUR_TAUX = 100_000;

    public function __construct(
        private LedgerAggregates $agregats,
        private LedgerReader $lecteur,
        private FeeMovements $mouvements,
        private FeeCalculator $calcul,
        private ManagementFeeInvoices $factures,
        private OrganizationDirectory $organisations,
        private RecordAudit $audit,
    ) {}

    /**
     * Relevés à poser pour les mois clos non encore facturés, du plus ancien au plus récent ; n'écrit rien.
     *
     * @return list<FeePlanItemData>
     */
    public function plan(string $mandantId, CarbonImmutable $today): array
    {
        $activation = $this->lecteur->ownerFundsCutoverAt();

        if ($activation === null) {
            return [];
        }

        $devise = $this->organisations->currency();
        $taux = $this->factures->vatRatePcm($today);
        $plan = [];
        $reports = [];

        foreach ($this->closedMonths($activation) as $mois) {
            $dernierJour = $mois->end->subDay();
            $mandats = $this->mouvements->schedules($mandantId, $dernierJour);
            $parMandat = $this->mouvements->byMandate($mandantId, $mandats, $devise, $mois->start, $dernierJour);

            foreach ($mandats as $mandat) {
                $existe = FeeStatement::query()->where('mandate_id', $mandat->mandateId)->where('period_start', $mois->start->toDateString())->first();
                $reports[$mandat->mandateId] ??= $this->lastCarried($mandat->mandateId, $mois->start);

                if ($existe !== null) {
                    $reports[$mandat->mandateId] = (int) $existe->carried_net->getAmount();

                    continue;
                }

                $segments = $this->mouvements->segments($mandat, $parMandat[$mandat->mandateId] ?? [], $dernierJour);

                if ($segments === null) {
                    continue;
                }

                $item = $this->item($mandat, $mandantId, $mois, $segments, $taux, $devise, $reports[$mandat->mandateId]);
                $reports[$mandat->mandateId] = 0;
                $plan[] = $item;
            }
        }

        return $plan;
    }

    /**
     * Pose les relevés du plan : facture ou avoir, puis relevé. Dans la transaction de l'appelant, verrou du compte mandant pris.
     *
     * @param  list<FeePlanItemData>  $plan
     * @return list<string> identifiants des factures émises
     */
    public function apply(array $plan, CarbonImmutable $today): array
    {
        $emises = [];

        foreach ($plan as $item) {
            $relevé = (string) Str::uuid7();
            $facture = null;
            $avoir = null;
            $reporte = 0;

            $ajuste = $item->result->net - $this->lastCarried($item->mandateId, $item->periodStart);

            if ($ajuste > 0) {
                $facture = $this->factures->issue(new FeeInvoiceRequestData(
                    $relevé, $item->mandantPartyId, $item->mandateId, $item->periodStart, $item->periodEnd->subDay(), $ajuste,
                    sprintf('Honoraires de gestion %s, mandat %s', $item->periodStart->format('m/Y'), $item->mandateReference),
                ), $today);
                $emises[] = $facture->invoiceId;
            } elseif ($ajuste < 0) {
                $avoir = $this->factures->creditLatest(
                    $item->mandateId, -$ajuste, 'owner_funds:fee_credit:'.$relevé,
                    sprintf('Honoraires de gestion %s : encaissement contrepassé', $item->periodStart->format('m/Y')), $today,
                );
                $reporte = -$ajuste - ($avoir->creditedNetMinor ?? 0);
            }

            $this->record($item, $relevé, $facture?->invoiceId, $avoir?->creditNoteId, $reporte);
        }

        return $emises;
    }

    /**
     * Honoraires estimés, TTC, sur les encaissements des mois pas encore clos : pourcentage seul, sans minimum ni forfait.
     */
    public function estimate(string $mandantId, CarbonImmutable $today): int
    {
        $activation = $this->lecteur->ownerFundsCutoverAt();

        if ($activation === null) {
            return 0;
        }

        $debut = $activation->startOfMonth();
        $ouvert = $this->agregats->firstOpenDay();
        $du = $ouvert !== null && $ouvert->greaterThan($debut) ? $ouvert : $debut;

        if ($du->greaterThan($today)) {
            return 0;
        }

        $devise = $this->organisations->currency();
        $mandats = $this->mouvements->schedules($mandantId, $today);
        $parMandat = $this->mouvements->byMandate($mandantId, $mandats, $devise, $du, $today);
        $taux = $this->factures->vatRatePcm($today);
        $total = 0;

        foreach ($mandats as $mandat) {
            $segments = $this->mouvements->segments($mandat, $parMandat[$mandat->mandateId] ?? [], $today);

            if ($segments === null) {
                continue;
            }

            $pourcentage = array_values(array_filter($segments, fn (FeeSegmentData $s): bool => $s->term->feeKind === FeeKind::Percentage && $s->term->feeBase !== null));

            if ($pourcentage === []) {
                continue;
            }

            $simples = array_map(fn (FeeSegmentData $s): FeeSegmentData => new FeeSegmentData(
                new MandateFeeTermData($s->term->id, $s->term->validFrom, $s->term->validTo, FeeKind::Percentage, $s->term->feeBasisPoints, null, $s->term->feeBase, 0, FeeTaxMode::ExclTax),
                $s->rent, $s->charges,
            ), $pourcentage);
            $total += $this->calcul->compute($simples, $taux, $devise)->gross;
        }

        return max(0, $total);
    }

    /**
     * @param  non-empty-list<FeeSegmentData>  $segments
     */
    private function item(MandateFeeScheduleData $mandat, string $mandantId, AccountingPeriodData $mois, array $segments, int $taux, Currency $devise, int $reportEntrant): FeePlanItemData
    {
        $resultat = $this->calcul->compute($segments, $taux, $devise);
        $ajuste = $resultat->net - $reportEntrant;
        $brut = $ajuste > 0 ? $ajuste + (int) (new Money($ajuste, $devise))->multiply($taux)->divide(self::DIVISEUR_TAUX)->getAmount() : 0;

        return new FeePlanItemData($mandat->mandateId, $mandat->reference, $mandantId, $mois->start, $mois->end, $resultat, $reportEntrant, $ajuste, $brut);
    }

    /**
     * @return list<AccountingPeriodData>
     */
    private function closedMonths(CarbonImmutable $activation): array
    {
        $debut = $activation->startOfMonth();

        return array_values(array_filter($this->agregats->periods(), fn (AccountingPeriodData $p): bool => $p->start->greaterThanOrEqualTo($debut)));
    }

    private function lastCarried(string $mandateId, CarbonImmutable $avant): int
    {
        $dernier = FeeStatement::query()->where('mandate_id', $mandateId)->where('period_start', '<', $avant->toDateString())->orderByDesc('period_start')->first();

        return $dernier === null ? 0 : (int) $dernier->carried_net->getAmount();
    }

    private function record(FeePlanItemData $item, string $id, ?string $factureId, ?string $avoirId, int $reporte): void
    {
        $r = $item->result;
        $devise = $this->organisations->currency()->getCode();
        $bareme = $r->term;

        $releve = new FeeStatement;
        $releve->forceFill([
            'id' => $id,
            'mandate_id' => $item->mandateId,
            'mandant_party_id' => $item->mandantPartyId,
            'period_start' => $item->periodStart->toDateString(),
            'period_end' => $item->periodEnd->toDateString(),
            'currency' => $devise,
            'base_rent' => new Money($r->baseRent, new Currency($devise)),
            'base_charges' => new Money($r->baseCharges, new Currency($devise)),
            'fee_kind' => $bareme?->feeKind->value,
            'rate_bp' => $bareme?->feeBasisPoints,
            'flat_amount' => $bareme?->feeFlatAmount,
            'minimum_amount' => $bareme->feeMinimumAmount ?? 0,
            'fee_tax_mode' => $bareme?->feeTaxMode->value,
            'term_ids' => $r->termIds,
            'fee_net' => new Money($r->net, new Currency($devise)),
            'tax_amount' => new Money($r->tax, new Currency($devise)),
            'fee_total' => new Money($r->gross, new Currency($devise)),
            'minimum_applied' => $r->minimumApplied,
            'carried_net' => new Money($reporte, new Currency($devise)),
            'invoice_id' => $factureId,
            'credit_note_id' => $avoirId,
        ])->save();

        $this->audit->handle('ownerfunds.fees.invoiced', subject: $releve, metadata: [
            'mandate_id' => $item->mandateId,
            'period' => $item->periodStart->format('Y-m'),
            'invoice_id' => $factureId,
            'credit_note_id' => $avoirId,
        ]);
    }
}
