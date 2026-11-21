<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\MandateFilters;
use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateEndRequest;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;

final readonly class MandateList
{
    /**
     * Tri par identifiant UUID v7 décroissant : les plus récents d'abord, sans colonne de date dans le curseur.
     *
     * @return CursorPaginator<int, Mandate>
     */
    public function list(MandateFilters $filtres, int $parPage): CursorPaginator
    {
        return Mandate::query()
            ->with(['units', 'terms'])
            ->when($filtres->archived, fn (Builder $q) => $q->whereNotNull('archived_at'), fn (Builder $q) => $q->whereNull('archived_at'))
            ->when($filtres->status !== null, fn (Builder $q) => $q->where('status', $filtres->status?->value))
            ->when($filtres->mandantPartyId !== null, fn (Builder $q) => $q->where('mandant_party_id', $filtres->mandantPartyId))
            ->when($filtres->endRequestPending, fn (Builder $q) => $q->whereIn('mandates.id', MandateEndRequest::query()->select('mandate_id')->where('status', EndRequestStatus::Pending->value)))
            ->when($filtres->unitId !== null, fn (Builder $q) => $q->whereHas('units', fn (Builder $u) => $u->where('unit_id', $filtres->unitId)))
            ->when($filtres->search !== null && $filtres->search !== '', fn (Builder $q) => $this->searching($q, (string) $filtres->search))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $filtres->cursor === null ? null : Cursor::fromEncoded($filtres->cursor));
    }

    /**
     * @param  Builder<Mandate>  $requete
     */
    private function searching(Builder $requete, string $terme): void
    {
        $motif = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($terme)).'%';

        $requete->whereRaw("LOWER(mandates.reference) LIKE ? ESCAPE '!'", [$motif]);
    }
}
