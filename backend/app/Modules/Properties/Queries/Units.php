<?php

declare(strict_types=1);

namespace App\Modules\Properties\Queries;

use App\Modules\Properties\Data\UnitFilters;
use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Unit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

final readonly class Units
{
    /**
     * @return CursorPaginator<int, Unit>
     */
    public function list(UnitFilters $filtres, int $parPage): CursorPaginator
    {
        return Unit::query()
            ->with('property')
            ->when($filtres->status === 'active', fn (Builder $q) => $q->whereNull('archived_at'))
            ->when($filtres->status === 'archived', fn (Builder $q) => $q->whereNotNull('archived_at'))
            ->when($filtres->propertyId !== null, fn (Builder $q) => $q->where('property_id', $filtres->propertyId))
            ->when($filtres->unitTypeTermId !== null, fn (Builder $q) => $q->where('unit_type_term_id', $filtres->unitTypeTermId))
            ->when($filtres->parentUnitId !== null, fn (Builder $q) => $q->where('parent_unit_id', $filtres->parentUnitId))
            ->when($filtres->rootOnly, fn (Builder $q) => $q->whereNull('parent_unit_id'))
            ->when($filtres->search !== null && $filtres->search !== '', fn (Builder $q) => $this->searching($q, (string) $filtres->search))
            ->orderBy('reference')
            ->orderBy('id')
            ->cursorPaginate($parPage);
    }

    public function get(string $id): Unit
    {
        return (Str::isUuid($id) ? Unit::query()->find($id) : null) ?? throw ErrorCode::UnitNotFound->problem();
    }

    public function locked(string $id): Unit
    {
        return (Str::isUuid($id) ? Unit::query()->whereKey($id)->lockForUpdate()->first() : null) ?? throw ErrorCode::UnitNotFound->problem();
    }

    /**
     * Lots actifs du site, dans l'ordre de leur référence.
     *
     * @return list<Unit>
     */
    public function activeOfProperty(string $propertyId): array
    {
        return array_values(Unit::query()->with('property')->where('property_id', $propertyId)->whereNull('archived_at')->orderBy('reference')->orderBy('id')->get()->all());
    }

    /**
     * @param  Builder<Unit>  $requete
     */
    private function searching(Builder $requete, string $terme): void
    {
        $motif = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($terme)).'%';

        $requete->where(function (Builder $q) use ($motif): void {
            $q->whereRaw("LOWER(units.reference) LIKE ? ESCAPE '!'", [$motif])
                ->orWhereHas('property', fn (Builder $p) => $p->whereRaw("LOWER(properties.name) LIKE ? ESCAPE '!'", [$motif]));
        });
    }
}
