<?php

declare(strict_types=1);

namespace App\Modules\Properties\Queries;

use App\Modules\Properties\Data\OwnerShareData;
use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Enums\OwnershipNature;
use App\Modules\Properties\Models\UnitOwnership;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

final readonly class Ownerships
{
    /**
     * @return list<UnitOwnership>
     */
    public function ofUnit(string $unitId, ?string $at = null): array
    {
        return array_values(UnitOwnership::query()
            ->where('unit_id', $unitId)
            ->when($at !== null, fn (Builder $q) => $this->inForceOn($q, (string) $at))
            ->orderByDesc('valid_from')
            ->orderBy('nature')
            ->orderBy('id')
            ->get()
            ->all());
    }

    public function get(string $unitId, string $id): UnitOwnership
    {
        return (Str::isUuid($id) ? UnitOwnership::query()->where('unit_id', $unitId)->find($id) : null) ?? throw ErrorCode::OwnershipNotFound->problem();
    }

    /**
     * Lignes de même nature dont la période recoupe [$debut, $fin) ; $fin nul : sans fin.
     *
     * @return list<UnitOwnership>
     */
    public function overlapping(string $unitId, OwnershipNature $nature, string $debut, ?string $fin): array
    {
        return array_values(UnitOwnership::query()
            ->where('unit_id', $unitId)
            ->where('nature', $nature->value)
            ->when($fin !== null, fn (Builder $q) => $q->where('valid_from', '<', $fin))
            ->where(fn (Builder $q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $debut))
            ->get()
            ->all());
    }

    /**
     * @return list<OwnerShareData>
     */
    public function ownersAt(string $unitId, DateTimeInterface $date): array
    {
        return array_map(
            fn (UnitOwnership $ligne): OwnerShareData => new OwnerShareData(
                partyId: $ligne->party_id,
                shareBp: $ligne->share_bp,
                nature: $ligne->nature,
                validFrom: $ligne->valid_from->toDateString(),
                validTo: $ligne->valid_to?->toDateString(),
            ),
            $this->ofUnit($unitId, $date->format('Y-m-d')),
        );
    }

    /**
     * @param  Builder<UnitOwnership>  $requete
     */
    private function inForceOn(Builder $requete, string $date): void
    {
        $requete->where('valid_from', '<=', $date)->where(fn (Builder $q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $date));
    }
}
