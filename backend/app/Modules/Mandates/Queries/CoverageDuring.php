<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\MandateSpanData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;

/**
 * Mandats sortis du brouillon qui couvrent au moins un jour d'une période : une ligne par mandat et par lot, deux requêtes quel que soit le nombre de mandants.
 */
final readonly class CoverageDuring
{
    /**
     * @param  list<string>|null  $mandantIds  null : tous les mandants de l'organisation
     * @return list<MandateSpanData>
     */
    public function of(CarbonImmutable $from, CarbonImmutable $to, ?array $mandantIds): array
    {
        if ($mandantIds === [] || $to->lessThan($from)) {
            return [];
        }

        $debut = $from->toDateString();
        $fin = $to->toDateString();

        $lignes = MandateUnit::query()
            ->select('mandate_units.*')
            ->join('mandates', fn (JoinClause $j) => $j->on('mandates.id', '=', 'mandate_units.mandate_id')->on('mandates.organization_id', '=', 'mandate_units.organization_id'))
            ->where('mandates.status', '<>', MandateStatus::Draft->value)
            ->where('mandates.starts_on', '<=', $fin)->where('mandates.ends_on', '>', $debut)
            ->where('mandate_units.valid_from', '<=', $fin)
            ->where(fn (Builder $q) => $q->whereNull('mandate_units.valid_to')->orWhere('mandate_units.valid_to', '>', $debut))
            ->when($mandantIds !== null, fn (Builder $q) => $q->whereIn('mandates.mandant_party_id', $mandantIds))
            ->with('mandate')
            ->orderBy('mandates.mandant_party_id')->orderBy('mandate_units.unit_id')->orderBy('mandate_units.mandate_id')->orderBy('mandate_units.valid_from')
            ->get();

        if ($lignes->isEmpty()) {
            return [];
        }

        $termes = MandateTerm::query()
            ->whereIn('mandate_id', $lignes->pluck('mandate_id')->unique()->all())
            ->where('valid_from', '<=', $fin)
            ->orderBy('valid_from')
            ->get()
            ->groupBy('mandate_id');

        $spans = [];

        foreach ($lignes as $ligne) {
            $mandat = $ligne->mandate;
            $premier = max($debut, $mandat->starts_on->toDateString(), $ligne->valid_from->toDateString());
            $borne = [$fin, $mandat->ends_on->toImmutable()->subDay()->toDateString()];

            if ($ligne->valid_to !== null) {
                $borne[] = $ligne->valid_to->toImmutable()->subDay()->toDateString();
            }

            $dernier = min($borne);
            $terme = ($termes->get($mandat->id) ?? collect())->filter(fn (MandateTerm $t): bool => $t->valid_from->toDateString() <= $dernier && ($t->valid_to === null || $t->valid_to->toDateString() > $dernier))->first();

            if ($terme === null || $dernier < $premier) {
                continue;
            }

            $spans[] = new MandateSpanData(
                mandateId: $mandat->id,
                reference: $mandat->reference,
                mandantPartyId: $mandat->mandant_party_id,
                unitId: $ligne->unit_id,
                from: $premier,
                to: $dernier,
                status: $mandat->status,
                feeKind: $terme->fee_kind,
                feeBasisPoints: $terme->fee_basis_points,
                feeFlatAmount: $terme->fee_flat_amount === null ? null : (int) $terme->fee_flat_amount->getAmount(),
                feeBase: $terme->fee_base,
                feeMinimumAmount: (int) $terme->fee_minimum_amount->getAmount(),
                feeTaxMode: $terme->fee_tax_mode,
                currency: $terme->currency,
            );
        }

        return $spans;
    }
}
