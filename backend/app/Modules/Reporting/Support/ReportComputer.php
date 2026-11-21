<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Mandates\Data\MandateSpanData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Modules\Reporting\Data\ComputedReport;
use App\Modules\Reporting\Data\LedgerFigures;
use App\Modules\Reporting\Data\ReportLineInput;
use App\Modules\Reporting\Data\ReportPeriod;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Enums\LineDirection;
use App\Modules\Reporting\Enums\LineKind;
use App\Modules\Reporting\Enums\ReportSection;
use App\Modules\Reporting\Jurisdictions\ManagementReportJurisdictions;
use Carbon\CarbonImmutable;

/**
 * Calcule un compte rendu : chiffres du grand livre (`FiguresReader`), faits des autres modules par leurs PublicApi, puis
 * instantané complet. Aucune écriture : l'appelant fige le résultat.
 */
final readonly class ReportComputer
{
    private const array ORDRE = ['rent_called', 'rent_collected', 'advance', 'adjustment', 'fee', 'fee_vat', 'works', 'payout', 'arrears'];

    public function __construct(
        private OrganizationDirectory $organisations,
        private ManagementReportJurisdictions $juridictions,
        private MandateDirectory $mandats,
        private UnitDirectory $lots,
        private LeaseDirectory $baux,
        private LeaseParticipants $participants,
        private PartyDirectory $parties,
        private LedgerAggregates $grandLivre,
        private FiguresReader $chiffres,
        private FactsReader $faits,
    ) {}

    /**
     * @param  list<string>  $sections
     * @param  array<string, mixed>  $options
     */
    public function compute(string $mandantId, ReportPeriod $periode, array $sections, array $options): ComputedReport
    {
        $identite = $this->organisations->legalIdentity() ?? throw ErrorCode::IssuerIncomplete->problem();
        $regles = $this->juridictions->for($this->organisations->country());
        $devise = $this->organisations->currency();
        $spans = $this->mandats->coverageDuring($periode->from, $periode->to, [$mandantId]);

        if ($spans === []) {
            throw ErrorCode::PeriodInvalid->problem('Aucun mandat de ce mandant ne couvre cette période.');
        }

        $lotIds = array_values(array_unique(array_map(fn (MandateSpanData $s): string => $s->unitId, $spans)));
        $lots = $this->lots->findMany($lotIds);
        $references = array_map(fn ($u): string => $u->reference, $lots);
        $chiffres = $this->chiffres->read($mandantId, $devise, $periode, $spans, $references);

        $occupations = $this->baux->occupancyAt($lotIds, $periode->to);
        $bailParLot = [];

        foreach ($occupations as $o) {
            if (! isset($bailParLot[$o->unitId]) || $o->isMain) {
                $bailParLot[$o->unitId] = ['id' => $o->leaseId, 'reference' => $o->leaseReference];
            }
        }

        $bailIds = array_values(array_unique(array_map(fn (array $b): string => $b['id'], $bailParLot)));
        $locataires = $this->participants->tenantsAtMany($bailIds, $periode->to);
        $locataireIds = [];

        foreach ($locataires as $parBail) {
            foreach ($parBail as $p) {
                $locataireIds[$p->partyId] = $p->partyId;
            }
        }

        $noms = $this->parties->findMany(array_values($locataireIds));
        $dettes = in_array(ReportSection::Arrears->value, $sections, true) ? $this->grandLivre->dueByLeases($bailIds, $devise, $periode->to) : [];
        $detailRelances = ($options['reminder_detail'] ?? false) === true;
        $procedures = in_array(ReportSection::Arrears->value, $sections, true) && $detailRelances ? $this->faits->activeRecoveryCases($bailIds) : [];

        $lignes = [...$chiffres->lines];

        foreach ($bailParLot as $lot => $bail) {
            $du = (int) ($dettes[$bail['id']] ?? null)?->getAmount();

            if ($du > 0) {
                $lignes[] = (new ReportLineInput(LineKind::Arrears, $periode->to->toDateString(), $lot, $bail['id'], null, 'Reste dû, bail '.$bail['reference'], $du, LineDirection::Credit, null, null))
                    ->withMandate($this->mandatDuLot($spans, $lot));
            }
        }

        $lignes = $this->ordonner($lignes);
        $chiffres = new LedgerFigures($chiffres->opening, $chiffres->closing, $chiffres->collected, $chiffres->fees, $chiffres->works, $chiffres->payout, $chiffres->adjustments, $chiffres->inTransit, $lignes, $chiffres->executions);

        $allocations = array_values(array_unique(array_filter(array_map(fn (ReportLineInput $l): ?string => $l->kind === LineKind::Works ? $l->sourceId : null, $lignes))));
        $quittances = in_array(ReportSection::Receipts->value, $sections, true) ? $this->faits->receipts($bailIds, $periode->from, $periode->to) : [];
        $compte = $this->parties->payoutAccount($mandantId, $periode->to);
        $mandant = $this->parties->invoiceIdentity($mandantId);

        $instantane = [
            'template_version' => $regles->templateVersion(),
            'jurisdiction' => $regles->jurisdiction(),
            'currency' => $devise->getCode(),
            'issuer' => [
                'legal_name' => $identite->legalName,
                'address' => $identite->address,
                'siren' => $identite->siren,
                'siret' => $identite->siret,
                'vat_number' => $identite->vatNumber,
                'professional_card_number' => $identite->professionalCardNumber,
                'professional_card_issuer' => $identite->professionalCardIssuer,
                'guarantee_provider' => $identite->guaranteeProvider,
                'guarantee_amount' => $identite->guaranteeAmount,
            ],
            'mandant' => ['party_id' => $mandantId, 'name' => $mandant->displayName, 'address' => $mandant->address, 'payout_account_last4' => $compte?->last4],
            'period' => ['kind' => $periode->kind->value, 'from' => $periode->from->toDateString(), 'to' => $periode->to->toDateString()],
            'sections' => $sections,
            'options' => ['letterhead' => ($options['letterhead'] ?? true) === true, 'reminder_detail' => $detailRelances, 'receipts_attached' => ($options['receipts_attached'] ?? false) === true],
            'mandates' => $this->mandates($spans),
            'units' => array_map(function (string $lot) use ($lots, $spans, $bailParLot, $locataires, $noms): array {
                $unite = $lots[$lot];
                $bail = $bailParLot[$lot] ?? null;

                return [
                    'id' => $lot,
                    'reference' => $unite->reference,
                    'property_name' => $unite->propertyName,
                    'address' => $unite->address,
                    'mandate_id' => $this->mandatDuLot($spans, $lot),
                    'lease_id' => $bail['id'] ?? null,
                    'lease_reference' => $bail['reference'] ?? null,
                    'tenants' => $bail === null ? [] : array_map(fn ($p): string => $noms[$p->partyId]->displayName, $locataires[$bail['id']] ?? []),
                ];
            }, $lotIds),
            'figures' => [
                'opening_balance' => $chiffres->opening,
                'collected_total' => $chiffres->collected,
                'fees_total' => $chiffres->fees,
                'works_total' => $chiffres->works,
                'payout_total' => $chiffres->payout,
                'adjustments_total' => $chiffres->adjustments,
                'closing_balance' => $chiffres->closing,
                'payouts_in_transit' => $chiffres->inTransit,
            ],
            'payout_executions' => $chiffres->executions,
            'lines' => array_map(fn (ReportLineInput $l): array => $l->toArray(), $lignes),
            'work_references' => $this->faits->interventionReferences($allocations),
            'recovery_cases' => $procedures,
            'receipts' => $quittances,
            'mentions' => $regles->mentions(),
            'generated_at' => CarbonImmutable::now()->toIso8601String(),
        ];

        $coupure = ['ledger_version' => $this->grandLivre->version(), 'closed_through' => $this->grandLivre->closedThrough()?->toDateString()];

        return new ComputedReport($chiffres, $instantane, $coupure, $chiffres->hash(), $regles->templateVersion());
    }

    /**
     * @param  list<MandateSpanData>  $spans
     * @return list<array<string, mixed>>
     */
    private function mandates(array $spans): array
    {
        $mandats = [];

        foreach ($spans as $s) {
            $mandats[$s->mandateId] ??= [
                'id' => $s->mandateId,
                'reference' => $s->reference,
                'status' => $s->status->value,
                'fee_kind' => $s->feeKind->value,
                'fee_basis_points' => $s->feeBasisPoints,
                'fee_flat_amount' => $s->feeFlatAmount,
                'fee_base' => $s->feeBase?->value,
                'fee_minimum_amount' => $s->feeMinimumAmount,
                'fee_tax_mode' => $s->feeTaxMode->value,
                'unit_ids' => [],
            ];
            $mandats[$s->mandateId]['unit_ids'][] = $s->unitId;
        }

        return array_values($mandats);
    }

    /**
     * @param  list<MandateSpanData>  $spans
     */
    private function mandatDuLot(array $spans, string $lot): ?string
    {
        $dernier = null;

        foreach ($spans as $s) {
            if ($s->unitId === $lot) {
                $dernier = $s->mandateId;
            }
        }

        return $dernier;
    }

    /**
     * @param  list<ReportLineInput>  $lignes
     * @return list<ReportLineInput>
     */
    private function ordonner(array $lignes): array
    {
        $indexees = array_map(fn (ReportLineInput $l, int $i): array => [$l, $i], $lignes, array_keys($lignes));
        usort($indexees, fn (array $a, array $b): int => [array_search($a[0]->kind->value, self::ORDRE, true), $a[0]->date, $a[1]] <=> [array_search($b[0]->kind->value, self::ORDRE, true), $b[0]->date, $b[1]]);

        return array_map(fn (array $x): ReportLineInput => $x[0], $indexees);
    }
}
