<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Rent\Data\LeaseRentBalanceData;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Support\Currencies;
use App\Modules\Rent\Support\Settlement;
use Carbon\CarbonImmutable;
use Money\Money;

final readonly class LeaseBalances
{
    public function __construct(
        private LeaseSchedule $baux,
        private LedgerReader $lecteur,
        private Settlement $reglement,
    ) {}

    /**
     * Lève lease_not_found hors de l'organisation courante.
     */
    public function of(string $leaseId, CarbonImmutable $asOf): LeaseRentBalanceData
    {
        $devise = Currencies::of($this->baux->billing($leaseId)->currency);
        $solde = $this->lecteur->dueByLease($leaseId, $devise);
        $ouvertes = Installment::query()
            ->where('lease_id', $leaseId)
            ->whereIn('status', array_map(fn (InstallmentStatus $s): string => $s->value, InstallmentStatus::open()))
            ->orderBy('due_date')->orderBy('id')
            ->get();
        $restes = $this->reglement->outstanding(array_values($ouvertes->all()));
        $zero = new Money(0, $devise);
        $retard = $zero;
        $impayees = 0;
        $plusAncienne = null;

        foreach ($ouvertes as $echeance) {
            $reste = $restes[$echeance->id];

            if (! $reste->isPositive()) {
                continue;
            }

            $impayees++;
            $plusAncienne ??= $echeance->due_date->toDateString();
            $retard = $echeance->due_date->toDateString() < $asOf->toDateString() ? $retard->add($reste) : $retard;
        }

        return new LeaseRentBalanceData($leaseId, $solde, $retard, $solde->isNegative() ? $solde->absolute() : $zero, $impayees, $plusAncienne);
    }
}
