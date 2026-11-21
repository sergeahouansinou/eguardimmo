<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Rent\Enums\AdjustmentStatus;
use App\Modules\Rent\Enums\LineSemantic;
use App\Modules\Rent\Models\RentAdjustment;
use Illuminate\Support\Collection;
use Money\Money;

/**
 * Lignes de régularisation en attente reprises par une échéance en cours de génération. Appelé sous le verrou du bail :
 * une échéance déjà générée n'est jamais modifiée.
 */
final class AdjustmentLines
{
    /**
     * Au plus une ligne par décompte et par échéance : les douzièmes se facturent un mois après l'autre.
     *
     * @return Collection<int, RentAdjustment>
     */
    public function eligible(string $leaseId, InstallmentDraft $brouillon): Collection
    {
        $vus = [];

        return RentAdjustment::query()
            ->where('lease_id', $leaseId)
            ->where('status', AdjustmentStatus::Pending->value)
            ->where('not_before', '<=', $brouillon->periodStart->toDateString())
            ->orderBy('not_before')->orderBy('source_id')->orderBy('position')
            ->lockForUpdate()
            ->get()
            ->filter(function (RentAdjustment $ligne) use (&$vus): bool {
                if (isset($vus[$ligne->source_id])) {
                    return false;
                }

                return $vus[$ligne->source_id] = true;
            })
            ->values();
    }

    /**
     * @param  Collection<int, RentAdjustment>  $ajustements
     */
    public function attach(InstallmentDraft $brouillon, Collection $ajustements): InstallmentDraft
    {
        if ($ajustements->isEmpty()) {
            return $brouillon;
        }

        $joursDuMois = BillingCalendar::days($brouillon->periodStart->startOfMonth(), $brouillon->periodStart->startOfMonth()->addMonthNoOverflow());

        return $brouillon->withChargeLines(array_values($ajustements->map(fn (RentAdjustment $a): DraftLine => $this->line($a->amount, $a->label, $brouillon, $joursDuMois))->all()));
    }

    public function line(Money $montant, string $libelle, InstallmentDraft $brouillon, int $joursDuMois): DraftLine
    {
        return new DraftLine('charges_adjustment', LineSemantic::ChargesAdjustment, $libelle, $brouillon->periodStart, $brouillon->periodStart, 1, $joursDuMois, $montant, $montant, 0, $montant->multiply(0));
    }
}
