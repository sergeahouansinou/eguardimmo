<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\Data\LeaseUnitData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Rent\Data\AdjustmentLineData;
use App\Modules\Rent\Enums\InstallmentKind;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\InstallmentLine;
use Carbon\CarbonImmutable;

/**
 * Échéance ponctuelle d'un bail qui n'aura plus d'échéance périodique : une seule ligne de régularisation, due à la date
 * de la ligne. Le mandat est figé à la création, d'après le décompte, pour qu'aucun produit d'agence n'apparaisse.
 */
final readonly class AdjustmentInstallments
{
    private const int JOURS_MAX = 366;

    public function __construct(
        private LeaseDirectory $annuaire,
        private LeaseParticipants $participants,
    ) {}

    public function isStandalone(LeaseBillingData $bail, CarbonImmutable $nonAvant): bool
    {
        return $bail->effectiveEndsOn !== null && $bail->effectiveEndsOn <= $nonAvant->toDateString();
    }

    public function create(LeaseBillingData $bail, AdjustmentLineData $ligne, ?string $mandateId, ?string $mandantPartyId): Installment
    {
        $donnees = $this->annuaire->find($bail->leaseId);
        $dernierJour = CarbonImmutable::parse($bail->effectiveEndsOn ?? $bail->startsOn)->subDay()->startOfDay();
        $dernierJour = $dernierJour->lessThan(CarbonImmutable::parse($bail->startsOn)) ? CarbonImmutable::parse($bail->startsOn) : $dernierJour;
        $locataires = $this->participants->tenantsAt($bail->leaseId, $dernierJour);
        $jour = $this->freeDay($bail->leaseId, $ligne->notBefore);
        $joursDuMois = BillingCalendar::days($jour->startOfMonth(), $jour->startOfMonth()->addMonthNoOverflow());
        $zero = $ligne->amount->multiply(0);

        $echeance = Installment::query()->create([
            'lease_id' => $bail->leaseId,
            'kind' => InstallmentKind::Adjustment,
            'party_id' => $locataires[0]->partyId ?? null,
            'unit_id' => $this->lastUnit($donnees->units),
            'period_start' => $jour->toDateString(),
            'period_end' => $jour->toDateString(),
            'due_date' => $ligne->notBefore->toDateString(),
            'status' => InstallmentStatus::Upcoming,
            'currency' => $bail->currency,
            'rent_amount' => $zero,
            'charges_amount' => $ligne->amount,
            'vat_amount' => $zero,
            'total_amount' => $ligne->amount,
            'mandate_id' => $mandateId,
            'mandant_party_id' => $mandantPartyId,
        ]);

        InstallmentLine::query()->create([
            'installment_id' => $echeance->id,
            'position' => 1,
            'component_key' => 'charges_adjustment',
            'semantic' => 'charges_adjustment',
            'label' => $ligne->label,
            'from_date' => $jour->toDateString(),
            'to_date' => $jour->toDateString(),
            'days' => 1,
            'month_days' => $joursDuMois,
            'currency' => $bail->currency,
            'monthly_amount' => $ligne->amount,
            'amount' => $ligne->amount,
            'vat_bp' => 0,
            'vat_amount' => $zero,
        ]);

        return $echeance;
    }

    private function freeDay(string $leaseId, CarbonImmutable $depuis): CarbonImmutable
    {
        $pris = Installment::query()->where('lease_id', $leaseId)->where('kind', InstallmentKind::Adjustment->value)->where('period_start', '>=', $depuis->toDateString())
            ->pluck('period_start')->map(fn (mixed $d): string => substr((string) $d, 0, 10))->all();
        $jour = $depuis->startOfDay();

        for ($i = 0; $i < self::JOURS_MAX; $i++, $jour = $jour->addDay()) {
            if (! in_array($jour->toDateString(), $pris, true)) {
                return $jour;
            }
        }

        return $jour;
    }

    /**
     * @param  list<LeaseUnitData>  $lots
     */
    private function lastUnit(array $lots): ?string
    {
        usort($lots, fn (LeaseUnitData $a, LeaseUnitData $b): int => [$b->isMain, $b->validFrom] <=> [$a->isMain, $a->validFrom]);

        return $lots[0]->unitId ?? null;
    }
}
