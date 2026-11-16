<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Parties\Data\PartyFilters;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Models\Party;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

final readonly class Parties
{
    /**
     * @return CursorPaginator<int, Party>
     */
    public function list(PartyFilters $filtres, int $parPage): CursorPaginator
    {
        return Party::query()
            ->with(['contactPoints' => fn ($requete) => $requete->where('is_primary', true)])
            ->when($filtres->status === 'active', fn (Builder $q) => $q->whereNull('archived_at'))
            ->when($filtres->status === 'archived', fn (Builder $q) => $q->whereNotNull('archived_at'))
            ->when($filtres->kind !== null, fn (Builder $q) => $q->where('kind', $filtres->kind?->value))
            ->when($filtres->categoryId !== null, fn (Builder $q) => $q->whereHas(
                'categories',
                fn (Builder $c) => $c->where('contact_category_term_id', $filtres->categoryId),
            ))
            ->when($filtres->search !== null && $filtres->search !== '', fn (Builder $q) => $this->searching($q, (string) $filtres->search))
            ->orderBy('display_name')
            ->orderBy('id')
            ->cursorPaginate($parPage);
    }

    public function get(string $id): Party
    {
        return (Str::isUuid($id) ? Party::query()->find($id) : null) ?? throw ErrorCode::PartyNotFound->problem();
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, Party> les parties trouvées, par identifiant
     */
    public function getMany(array $ids): array
    {
        $valides = array_values(array_filter($ids, fn (string $id): bool => Str::isUuid($id)));

        return $valides === [] ? [] : Party::query()->whereIn('id', $valides)->get()->keyBy('id')->all();
    }

    /**
     * @param  Builder<Party>  $requete
     */
    private function searching(Builder $requete, string $terme): void
    {
        $motif = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($terme)).'%';

        $requete->where(function (Builder $q) use ($motif): void {
            $q->whereRaw("LOWER(parties.display_name) LIKE ? ESCAPE '!'", [$motif])
                ->orWhereHas('contactPoints', fn (Builder $c) => $c->where('type', 'email')->whereRaw("contact_points.value LIKE ? ESCAPE '!'", [$motif]));
        });
    }
}
