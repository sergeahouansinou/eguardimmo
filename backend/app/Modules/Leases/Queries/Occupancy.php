<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Support\LeaseOccupancy;
use App\Modules\Leases\Support\LeasePhaseResolver;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

final readonly class Occupancy
{
    public function __construct(
        private LeasePhaseResolver $phases,
        private LeaseViews $vues,
    ) {}

    /**
     * Un lot est occupé par le bail signé (ou terminé avec une fin connue) dont la période et celle du lot couvrent la date.
     * Lève unit_not_found si un lot est inconnu ou hors de l'organisation.
     *
     * @param  list<string>  $unitIds
     * @return list<OccupancyEntry>
     */
    public function at(array $unitIds, CarbonInterface $date): array
    {
        $unitIds = array_values(array_unique($unitIds));
        $lots = $this->vues->unitData($unitIds);
        $jour = $date->toDateString();

        $lignes = LeaseUnit::query()
            ->whereIn('unit_id', $unitIds)
            ->where('valid_from', '<=', $jour)
            ->where(fn (Builder $e) => $e->whereNull('valid_to')->orWhere('valid_to', '>', $jour))
            ->whereHas('lease', fn (Builder $b) => LeaseOccupancy::between($b, $jour))
            ->with(['lease.parties' => fn ($q) => $q
                ->where('role', LeasePartyRole::Tenant->value)
                ->where('valid_from', '<=', $jour)
                ->where(fn (Builder $e) => $e->whereNull('valid_to')->orWhere('valid_to', '>', $jour))
                ->orderBy('valid_from')->orderBy('id')])
            ->get()
            ->sortByDesc(fn (LeaseUnit $l): string => $l->lease->starts_on->toDateString().$l->id)
            ->groupBy('unit_id');

        $parties = $this->vues->partyData(array_values($lignes->flatten(1)->flatMap(fn (LeaseUnit $l): array => $l->lease->parties->pluck('party_id')->all())->all()));

        return array_map(function (string $id) use ($lots, $lignes, $parties, $date): OccupancyEntry {
            $occupation = $lignes->get($id)?->first();

            if (! $occupation instanceof LeaseUnit) {
                return new OccupancyEntry($lots[$id]);
            }

            return new OccupancyEntry(
                unit: $lots[$id],
                lease: $occupation->lease,
                occupation: $occupation,
                phase: $this->phases->at($occupation->lease, $date),
                tenants: array_values(array_map(fn ($p) => $parties[$p->party_id], $occupation->lease->parties->all())),
            );
        }, $unitIds);
    }
}
