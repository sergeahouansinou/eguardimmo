<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\MandateCoverageData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;

/**
 * Mandat qui couvre un lot à une date : mandat sorti du brouillon, ligne de lot et mandat valides ce jour-là.
 */
final readonly class CoverageAt
{
    /**
     * @param  list<string>  $unitIds
     * @return array<string, MandateCoverageData> par identifiant de lot
     */
    public function of(array $unitIds, CarbonImmutable $date): array
    {
        $unitIds = array_values(array_unique($unitIds));

        if ($unitIds === []) {
            return [];
        }

        $jour = $date->toDateString();

        $lignes = MandateUnit::query()
            ->select('mandate_units.*')
            ->join('mandates', fn (JoinClause $j) => $j->on('mandates.id', '=', 'mandate_units.mandate_id')->on('mandates.organization_id', '=', 'mandate_units.organization_id'))
            ->where('mandates.status', '<>', MandateStatus::Draft->value)
            ->where('mandates.starts_on', '<=', $jour)->where('mandates.ends_on', '>', $jour)
            ->where('mandate_units.valid_from', '<=', $jour)
            ->where(fn (Builder $q) => $q->whereNull('mandate_units.valid_to')->orWhere('mandate_units.valid_to', '>', $jour))
            ->whereIn('mandate_units.unit_id', $unitIds)
            ->with('mandate')
            ->orderBy('mandate_units.unit_id')->orderBy('mandate_units.mandate_id')->orderBy('mandate_units.id')
            ->get();

        $conditions = MandateTerm::query()
            ->whereIn('mandate_id', $lignes->pluck('mandate_id')->unique()->all())
            ->where('valid_from', '<=', $jour)
            ->where(fn (Builder $q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $jour))
            ->get()
            ->keyBy('mandate_id');

        $resultat = [];

        foreach ($lignes as $ligne) {
            $terme = $conditions->get($ligne->mandate_id);

            if ($terme === null || isset($resultat[$ligne->unit_id])) {
                continue;
            }

            $mandat = $ligne->mandate;
            $fin = $ligne->valid_to === null ? $mandat->ends_on : ($ligne->valid_to->lessThan($mandat->ends_on) ? $ligne->valid_to : $mandat->ends_on);

            $resultat[$ligne->unit_id] = new MandateCoverageData(
                unitId: $ligne->unit_id,
                mandateId: $mandat->id,
                reference: $mandat->reference,
                mandantPartyId: $mandat->mandant_party_id,
                status: $mandat->status,
                isSuspended: $mandat->status === MandateStatus::Suspended,
                startsOn: $mandat->starts_on->toDateString(),
                endDate: $fin->toImmutable()->subDay()->toDateString(),
                feeKind: $terme->fee_kind,
                feeBasisPoints: $terme->fee_basis_points,
                feeFlatAmount: $terme->fee_flat_amount === null ? null : (int) $terme->fee_flat_amount->getAmount(),
                currency: $terme->currency,
                payoutDay: $terme->payout_day,
                worksLimitAmount: (int) $terme->works_limit_amount->getAmount(),
                feeBase: $terme->fee_base,
                feeMinimumAmount: (int) $terme->fee_minimum_amount->getAmount(),
                feeTaxMode: $terme->fee_tax_mode,
            );
        }

        return $resultat;
    }
}
