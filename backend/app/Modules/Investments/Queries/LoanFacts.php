<?php

declare(strict_types=1);

namespace App\Modules\Investments\Queries;

use App\Modules\Investments\Data\AcquisitionData;
use App\Modules\Investments\Data\LoanCostData;
use App\Modules\Investments\Data\LoanInstallmentData;
use App\Modules\Investments\Enums\LoanStatus;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Models\LoanFee;
use App\Modules\Investments\Models\LoanInterestAttestation;
use App\Modules\Investments\Models\LoanScheduleLine;
use App\Modules\Investments\Models\PropertyAcquisition;
use App\Modules\Investments\Support\Currencies;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Lectures des prêts non annulés pour les autres modules : toujours la dernière version de l'échéancier.
 */
final readonly class LoanFacts
{
    /**
     * Intérêts payés et assurance de l'année : attestation de la banque si elle existe, sinon échéancier (échéances payées) et frais saisis.
     *
     * @param  list<string>|null  $propertyIds
     * @return list<LoanCostData>
     */
    public function deductible(int $year, ?array $propertyIds): array
    {
        if ($propertyIds === []) {
            return [];
        }

        $debut = sprintf('%04d-01-01', $year);
        $fin = sprintf('%04d-01-01', $year + 1);
        $attestations = LoanInterestAttestation::query()->where('income_year', $year)->get()->keyBy('loan_id');
        $echeancier = $this->scheduleTotals($debut, $fin);
        $frais = $this->feeTotals($debut, $fin);
        $couts = [];

        foreach ($this->loans($propertyIds) as $pret) {
            $attestation = $attestations->get($pret->id);
            $code = $pret->currency;

            if ($attestation instanceof LoanInterestAttestation) {
                $couts[] = new LoanCostData($pret->id, $pret->property_id, $pret->unit_id, 'attestation', $attestation->interest, $attestation->insurance, $attestation->fees);

                continue;
            }

            $lignes = $echeancier[$pret->id] ?? null;
            $fraisPret = $frais[$pret->id] ?? 0;

            if ($lignes !== null || $fraisPret > 0) {
                $couts[] = new LoanCostData($pret->id, $pret->property_id, $pret->unit_id, 'schedule', Currencies::money($lignes['interest'] ?? 0, $code), Currencies::money($lignes['insurance'] ?? 0, $code), Currencies::money($fraisPret, $code));
            }
        }

        return $couts;
    }

    /**
     * Biens qui ont un prêt suivi pour l'année : attestation, échéance ou frais dans l'année.
     *
     * @return list<string>
     */
    public function trackedProperties(int $year): array
    {
        return array_values(array_unique(array_map(fn (LoanCostData $c): string => $c->propertyId, $this->deductible($year, null))));
    }

    /**
     * Échéances des prêts non annulés dont la date est dans [from, toExclusive), assurance comprise.
     *
     * @param  list<string>|null  $propertyIds
     * @return list<LoanInstallmentData>
     */
    public function installments(CarbonImmutable $from, CarbonImmutable $toExclusive, ?array $propertyIds): array
    {
        if ($propertyIds === []) {
            return [];
        }

        $lignes = $this->latestLines()
            ->where('loan_schedule_lines.due_on', '>=', $from->toDateString())->where('loan_schedule_lines.due_on', '<', $toExclusive->toDateString())
            ->when($propertyIds !== null, fn (Builder $q) => $q->whereIn('l.property_id', (array) $propertyIds))
            ->selectRaw('loan_schedule_lines.loan_id as loan_id, l.property_id as property_id, l.unit_id as unit_id, loan_schedule_lines.due_on as due_on, loan_schedule_lines.currency as currency, loan_schedule_lines.payment as payment, loan_schedule_lines.interest as interest, loan_schedule_lines.insurance as insurance')
            ->orderBy('loan_schedule_lines.due_on')->orderBy('loan_schedule_lines.loan_id')->toBase()->get();

        return array_values($lignes->map(fn (object $l): LoanInstallmentData => new LoanInstallmentData(
            (string) $l->loan_id, (string) $l->property_id, is_string($l->unit_id) ? $l->unit_id : null, substr((string) $l->due_on, 0, 10),
            Currencies::money($l->payment, (string) $l->currency), Currencies::money($l->interest, (string) $l->currency), Currencies::money($l->insurance, (string) $l->currency),
        ))->all());
    }

    /**
     * @param  list<string>|null  $propertyIds
     * @return list<AcquisitionData>
     */
    public function acquisitions(?array $propertyIds): array
    {
        if ($propertyIds === []) {
            return [];
        }

        return array_values(PropertyAcquisition::query()
            ->when($propertyIds !== null, fn (Builder $q) => $q->whereIn('property_id', (array) $propertyIds))
            ->orderBy('acquired_on')->orderBy('id')->get()
            ->map(fn (PropertyAcquisition $a): AcquisitionData => new AcquisitionData($a->property_id, $a->unit_id, $a->acquired_on->toDateString(), $a->total()))->all());
    }

    /**
     * @param  list<string>  $loanIds
     */
    public function markUsed(array $loanIds, int $year): void
    {
        $maintenant = now()->format('Y-m-d H:i:s.u');
        $organisation = Loan::query()->whereIn('id', $loanIds)->pluck('organization_id', 'id');

        foreach ($organisation as $id => $org) {
            DB::table('loan_usages')->insertOrIgnore(['id' => (string) Str::uuid7(), 'organization_id' => $org, 'loan_id' => $id, 'income_year' => $year, 'created_at' => $maintenant, 'updated_at' => $maintenant]);
        }
    }

    /**
     * @param  list<string>|null  $propertyIds
     * @return list<Loan>
     */
    private function loans(?array $propertyIds): array
    {
        return array_values(Loan::query()->where('status', '!=', LoanStatus::Voided->value)
            ->when($propertyIds !== null, fn (Builder $q) => $q->whereIn('property_id', (array) $propertyIds))
            ->orderBy('id')->get()->all());
    }

    /**
     * @return array<string, array{interest: int, insurance: int}>
     */
    private function scheduleTotals(string $debut, string $fin): array
    {
        $totaux = [];

        $lues = $this->latestLines()
            ->where('loan_schedule_lines.due_on', '>=', $debut)->where('loan_schedule_lines.due_on', '<', $fin)
            ->where('loan_schedule_lines.payment', '>', 0)
            ->selectRaw('loan_schedule_lines.loan_id as loan_id, sum(loan_schedule_lines.interest) as interest, sum(loan_schedule_lines.insurance) as insurance')
            ->groupBy('loan_schedule_lines.loan_id')->toBase()->get();

        foreach ($lues as $l) {
            $totaux[(string) $l->loan_id] = ['interest' => (int) $l->interest, 'insurance' => (int) $l->insurance];
        }

        return $totaux;
    }

    /**
     * @return array<string, int>
     */
    private function feeTotals(string $debut, string $fin): array
    {
        $totaux = [];

        foreach (LoanFee::query()->where('paid_on', '>=', $debut)->where('paid_on', '<', $fin)->selectRaw('loan_id, sum(amount) as total')->groupBy('loan_id')->toBase()->get() as $l) {
            $totaux[(string) $l->loan_id] = (int) $l->total;
        }

        return $totaux;
    }

    /**
     * @return Builder<LoanScheduleLine>
     */
    private function latestLines(): Builder
    {
        return LoanScheduleLine::query()
            ->join('loan_schedules as s', 's.id', '=', 'loan_schedule_lines.loan_schedule_id')
            ->join('loans as l', 'l.id', '=', 'loan_schedule_lines.loan_id')
            ->whereRaw('s.version = (select max(ms.version) from loan_schedules ms where ms.loan_id = s.loan_id)')
            ->where('l.status', '!=', LoanStatus::Voided->value);
    }
}
