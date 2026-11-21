<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;

/**
 * Couvertures de lots par des mandats sortis du brouillon, périodes semi-ouvertes [from, to).
 * Un mandat suspendu, résilié avec préavis ou expiré compte : il a couvert le lot sur sa période.
 */
final readonly class UnitCoverages
{
    /**
     * Jointure explicite et non sous-requête : cette lecture décide d'un invariant et doit suivre le verrou des lots.
     *
     * @param  list<string>  $unitIds
     * @return list<array{mandate_id: string, unit_id: string, from: string, to: string}>
     */
    public function of(array $unitIds, ?string $exceptMandateId = null): array
    {
        $lignes = MandateUnit::query()
            ->select('mandate_units.*')
            ->join('mandates', fn (JoinClause $j) => $j->on('mandates.id', '=', 'mandate_units.mandate_id')->on('mandates.organization_id', '=', 'mandate_units.organization_id'))
            ->where('mandates.status', '<>', MandateStatus::Draft->value)
            ->whereIn('mandate_units.unit_id', $unitIds)
            ->when($exceptMandateId !== null, fn (Builder $q) => $q->where('mandate_units.mandate_id', '<>', $exceptMandateId))
            ->with('mandate')
            ->orderBy('mandate_units.unit_id')->orderBy('mandate_units.valid_from')->orderBy('mandate_units.id')
            ->get();

        $couvertures = [];

        foreach ($lignes as $ligne) {
            $periode = $this->period($ligne->valid_from->toDateString(), $ligne->valid_to?->toDateString(), $ligne->mandate);

            if ($periode !== null) {
                $couvertures[] = ['mandate_id' => $ligne->mandate_id, 'unit_id' => $ligne->unit_id, ...$periode];
            }
        }

        return $couvertures;
    }

    /**
     * @return array{from: string, to: string}|null null si la période est vide
     */
    public function period(string $from, ?string $to, Mandate $mandat): ?array
    {
        $debut = max($from, $mandat->starts_on->toDateString());
        $finMandat = $mandat->ends_on->toDateString();
        $fin = $to === null ? $finMandat : min($to, $finMandat);

        return $fin <= $debut ? null : ['from' => $debut, 'to' => $fin];
    }

    public function overlap(string $fromA, string $toA, string $fromB, string $toB): bool
    {
        return $fromA < $toB && $fromB < $toA;
    }
}
