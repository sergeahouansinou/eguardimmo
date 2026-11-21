<?php

declare(strict_types=1);

namespace App\Modules\Investments\Queries;

use App\Modules\Investments\Enums\ErrorCode;
use App\Modules\Investments\Models\Loan;
use App\Modules\Investments\Models\LoanFee;
use App\Modules\Investments\Models\LoanInterestAttestation;
use App\Modules\Investments\Models\PropertyAcquisition;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class Loans
{
    private const int PLAFOND = 200;

    /**
     * @return list<Loan>
     */
    public function list(?string $propertyId, ?string $status): array
    {
        return array_values(Loan::query()
            ->when($propertyId !== null, fn (Builder $q) => $q->where('property_id', $propertyId))
            ->when($status !== null, fn (Builder $q) => $q->where('status', $status))
            ->orderBy('first_due_on')->orderBy('id')->limit(self::PLAFOND)->get()->all());
    }

    public function get(string $id): Loan
    {
        return (Str::isUuid($id) ? Loan::query()->find($id) : null) ?? throw ErrorCode::LoanNotFound->problem();
    }

    /**
     * Capital restant dû selon l'échéancier à cette date (dernière version) : donnée contractuelle, jamais un solde comptable.
     *
     * @param  list<Loan>  $prets
     * @return array<string, int> par prêt ; sans échéance échue, le capital emprunté
     */
    public function outstanding(array $prets, CarbonImmutable $date): array
    {
        $restants = [];

        foreach ($prets as $p) {
            $restants[$p->id] = (int) $p->principal->getAmount();
        }

        if ($prets === []) {
            return [];
        }

        $lues = DB::table('loan_schedule_lines as l')
            ->join('loan_schedules as s', 's.id', '=', 'l.loan_schedule_id')
            ->whereIn('l.loan_id', array_keys($restants))
            ->whereRaw('s.version = (select max(ms.version) from loan_schedules ms where ms.loan_id = s.loan_id)')
            ->where('l.due_on', '<=', $date->toDateString())
            ->whereRaw('l.position = (select max(p.position) from loan_schedule_lines p where p.loan_schedule_id = l.loan_schedule_id and p.due_on <= ?)', [$date->toDateString()])
            ->get(['l.loan_id', 'l.outstanding_after']);

        foreach ($lues as $l) {
            $restants[(string) $l->loan_id] = (int) $l->outstanding_after;
        }

        return $restants;
    }

    /**
     * @return list<LoanFee>
     */
    public function fees(string $loanId): array
    {
        return array_values(LoanFee::query()->where('loan_id', $loanId)->orderBy('paid_on')->orderBy('id')->get()->all());
    }

    /**
     * @return list<LoanInterestAttestation>
     */
    public function attestations(string $loanId): array
    {
        return array_values(LoanInterestAttestation::query()->where('loan_id', $loanId)->orderBy('income_year')->get()->all());
    }

    /**
     * @return list<PropertyAcquisition>
     */
    public function acquisitions(?string $propertyId): array
    {
        return array_values(PropertyAcquisition::query()
            ->when($propertyId !== null, fn (Builder $q) => $q->where('property_id', $propertyId))
            ->orderBy('acquired_on')->orderBy('id')->limit(self::PLAFOND)->get()->all());
    }

    public function acquisition(string $id): PropertyAcquisition
    {
        return (Str::isUuid($id) ? PropertyAcquisition::query()->find($id) : null) ?? throw ErrorCode::AcquisitionNotFound->problem();
    }
}
