<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Rent\Data\OwnerBackfillItemData;
use App\Modules\Rent\Data\OwnerBackfillReportData;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Enums\PaymentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\PaymentAllocation;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Rattrapage des échéances émises avant l'activation des fonds des mandants (ADR 0031, décision 8) : additif et rejouable.
 * Les écritures reprennent la date d'origine, donc le rattrapage est refusé dès qu'un mois est clos. La banque n'est pas déplacée.
 */
final readonly class OwnerBackfill
{
    public function __construct(
        private Ledger $livre,
        private LedgerAggregates $agregats,
        private MandateDirectory $mandats,
        private Settlement $reglement,
        private RecordAudit $audit,
    ) {}

    public function plan(): OwnerBackfillReportData
    {
        $items = [];
        $sans = [];

        foreach ($this->candidates() as $echeance) {
            $couverture = $echeance->unit_id === null ? null : $this->mandats->coveringUnit($echeance->unit_id, $echeance->period_start);

            if ($couverture === null) {
                $sans[] = $echeance->id;

                continue;
            }

            $parts = $this->allocations($echeance->id);
            $items[] = new OwnerBackfillItemData(
                $echeance->id, $echeance->lease_id, $couverture->mandateId, $couverture->mandantPartyId, $echeance->period_start->toDateString(),
                (int) $echeance->total_amount->getAmount(), (int) array_sum(array_map(fn (PaymentAllocation $a): int => (int) $a->amount->getAmount(), $parts)), count($parts),
            );
        }

        return new OwnerBackfillReportData($items, $sans);
    }

    public function apply(): OwnerBackfillReportData
    {
        if ($this->agregats->periods() !== []) {
            throw ErrorCode::OwnerBackfillAfterClose->problem();
        }

        $faits = [];

        foreach ($this->plan()->items as $item) {
            if (DB::transaction(fn (): bool => $this->reclassify($item))) {
                $faits[] = $item;
            }
        }

        $rapport = new OwnerBackfillReportData($faits, $this->plan()->unmapped);
        $this->audit->handle('ownerfunds.backfill.applied', metadata: ['installments' => count($faits), 'unmapped' => count($rapport->unmapped)]);

        return $rapport;
    }

    private function reclassify(OwnerBackfillItemData $item): bool
    {
        $echeance = Installment::query()->whereKey($item->installmentId)->lockForUpdate()->firstOrFail();

        if ($echeance->mandate_id !== null) {
            return false;
        }

        $this->livre->lockParty($item->mandantPartyId);
        $echeance->mandate_id = $item->mandateId;
        $echeance->mandant_party_id = $item->mandantPartyId;
        $echeance->save();
        $this->livre->post($this->call($echeance));

        foreach ($this->allocations($echeance->id) as $part) {
            $lignes = $this->reglement->collectLines($echeance, $part->amount);

            if ($lignes !== []) {
                $this->livre->post($this->collect($echeance, $part, $lignes));
            }
        }

        return true;
    }

    private function call(Installment $echeance): EntryData
    {
        $analytique = [$echeance->lease_id, $echeance->party_id, $echeance->unit_id];
        $lignes = [];

        foreach ([[AccountRole::RentRevenue, AccountRole::OwnerRentCalled, $echeance->rent_amount], [AccountRole::ChargesRecovered, AccountRole::OwnerChargesCalled, $echeance->charges_amount], [AccountRole::VatCollected, AccountRole::OwnerVatCalled, $echeance->vat_amount]] as [$produit, $appele, $montant]) {
            if ($montant->isPositive()) {
                $lignes[] = LineData::debit($produit, $montant, ...$analytique);
                $lignes[] = LineData::credit($appele, $montant, $echeance->lease_id, $echeance->mandant_party_id, $echeance->unit_id, ItemType::Installment, $echeance->id);
            }
        }

        return new EntryData(
            Journal::Adjustments,
            CarbonImmutable::parse(($echeance->issued_on ?? $echeance->period_start)->toDateString()),
            sprintf('Rattrapage fonds des mandants : appel du %s', $echeance->period_start->format('d/m/Y')),
            SourceType::Adjustment,
            $echeance->id,
            "owner_funds:backfill:{$echeance->id}:call",
            $lignes,
        );
    }

    /**
     * @param  list<LineData>  $lignes
     */
    private function collect(Installment $echeance, PaymentAllocation $part, array $lignes): EntryData
    {
        return new EntryData(
            Journal::Adjustments,
            CarbonImmutable::parse($part->payment->received_on->toDateString()),
            sprintf('Rattrapage fonds des mandants : encaissement du %s', $part->payment->received_on->format('d/m/Y')),
            SourceType::Adjustment,
            $part->id,
            "owner_funds:backfill:{$part->id}:collect",
            $lignes,
        );
    }

    /**
     * @return list<Installment>
     */
    private function candidates(): array
    {
        return array_values(Installment::query()
            ->whereNull('mandate_id')->whereNotNull('issued_on')
            ->where('status', '<>', InstallmentStatus::Cancelled->value)
            ->orderBy('period_start')->orderBy('id')->get()->all());
    }

    /**
     * @return list<PaymentAllocation>
     */
    private function allocations(string $installmentId): array
    {
        return array_values(PaymentAllocation::query()
            ->where('installment_id', $installmentId)->whereNull('reversed_at')
            ->whereHas('payment', fn ($q) => $q->where('status', PaymentStatus::Recorded->value))
            ->with('payment')
            ->get()
            ->sortBy(fn (PaymentAllocation $a): string => $a->payment->received_on->toDateString().$a->id)
            ->all());
    }
}
