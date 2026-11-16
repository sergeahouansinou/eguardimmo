<?php

declare(strict_types=1);

namespace App\Modules\Properties\Queries;

use App\Modules\Properties\Data\PropertyFilters;
use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Property;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

final readonly class Properties
{
    /**
     * @return CursorPaginator<int, Property>
     */
    public function list(PropertyFilters $filtres, int $parPage): CursorPaginator
    {
        return $this->withCounts(Property::query())
            ->when($filtres->status === 'active', fn (Builder $q) => $q->whereNull('archived_at'))
            ->when($filtres->status === 'archived', fn (Builder $q) => $q->whereNotNull('archived_at'))
            ->when($filtres->type !== null, fn (Builder $q) => $q->where('type', $filtres->type?->value))
            ->when($filtres->search !== null && $filtres->search !== '', fn (Builder $q) => $this->searching($q, (string) $filtres->search))
            ->orderBy('name')
            ->orderBy('id')
            ->cursorPaginate($parPage);
    }

    public function get(string $id): Property
    {
        return (Str::isUuid($id) ? $this->withCounts(Property::query())->find($id) : null) ?? throw ErrorCode::PropertyNotFound->problem();
    }

    public function locked(string $id): Property
    {
        return (Str::isUuid($id) ? Property::query()->whereKey($id)->lockForUpdate()->first() : null) ?? throw ErrorCode::PropertyNotFound->problem();
    }

    /**
     * @param  Builder<Property>  $requete
     * @return Builder<Property>
     */
    private function withCounts(Builder $requete): Builder
    {
        return $requete->withCount(['units as active_units_count' => fn (Builder $q) => $q->whereNull('archived_at')]);
    }

    /**
     * @param  Builder<Property>  $requete
     */
    private function searching(Builder $requete, string $terme): void
    {
        $motif = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($terme)).'%';

        $requete->where(function (Builder $q) use ($motif): void {
            $q->whereRaw("LOWER(properties.name) LIKE ? ESCAPE '!'", [$motif]);

            foreach (['line1', 'postal_code', 'city'] as $cle) {
                $q->orWhereRaw("LOWER(JSON_EXTRACT(properties.address, ?)) LIKE ? ESCAPE '!'", ["$.{$cle}", $motif]);
            }
        });
    }
}
