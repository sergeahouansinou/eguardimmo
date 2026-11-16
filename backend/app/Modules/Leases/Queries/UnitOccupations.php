<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Support\LeaseOccupancy;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;

/**
 * Occupations effectives de lots par des baux signés (ou terminés avec une fin connue), périodes semi-ouvertes [from, to).
 * La fin est la plus proche de la fin de la ligne de lot, de `ends_on` et de `notice_departure_on` ; sans fin, l'occupation est ouverte.
 */
final readonly class UnitOccupations
{
    /**
     * Jointure explicite et non sous-requête : cette lecture décide d'un invariant et doit suivre le verrou des lots.
     *
     * @param  list<string>|null  $unitIds  null : tous les lots de l'organisation courante
     * @return list<array{lease_id: string, unit_id: string, from: string, to: string|null}>
     */
    public function of(?array $unitIds = null, ?string $exceptLeaseId = null): array
    {
        $lignes = LeaseUnit::query()
            ->select('lease_units.*')
            ->join('leases', fn (JoinClause $j) => $j->on('leases.id', '=', 'lease_units.lease_id')->on('leases.organization_id', '=', 'lease_units.organization_id'))
            ->tap(fn (Builder $q) => LeaseOccupancy::status($q))
            ->when($unitIds !== null, fn (Builder $q) => $q->whereIn('lease_units.unit_id', $unitIds ?? []))
            ->when($exceptLeaseId !== null, fn (Builder $q) => $q->where('lease_units.lease_id', '<>', $exceptLeaseId))
            ->with('lease')
            ->orderBy('lease_units.unit_id')->orderBy('lease_units.valid_from')->orderBy('lease_units.id')
            ->get();

        $occupations = [];

        foreach ($lignes as $ligne) {
            $periode = $this->period($ligne->valid_from->toDateString(), $ligne->valid_to?->toDateString(), $ligne->lease);

            if ($periode !== null) {
                $occupations[] = ['lease_id' => $ligne->lease_id, 'unit_id' => $ligne->unit_id, ...$periode];
            }
        }

        return $occupations;
    }

    /**
     * @return array{from: string, to: string|null}|null null si la période est vide
     */
    public function period(string $from, ?string $to, Lease $bail): ?array
    {
        $debut = max($from, $bail->starts_on->toDateString());
        $fins = array_filter([$to, $bail->effectiveEnd()], fn (?string $f): bool => $f !== null);
        $fin = $fins === [] ? null : min($fins);

        return $fin !== null && $fin <= $debut ? null : ['from' => $debut, 'to' => $fin];
    }

    public function overlap(string $fromA, ?string $toA, string $fromB, ?string $toB): bool
    {
        return ($toA === null || $fromB < $toA) && ($toB === null || $fromA < $toB);
    }
}
