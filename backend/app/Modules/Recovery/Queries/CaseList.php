<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Queries;

use App\Modules\Recovery\Data\CaseFilters;
use App\Modules\Recovery\Models\RecoveryCase;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;

final readonly class CaseList
{
    /**
     * Tri par identifiant UUID v7 décroissant : du plus récent au plus ancien, sans date dans le curseur.
     *
     * @return CursorPaginator<int, RecoveryCase>
     */
    public function list(CaseFilters $filtres, int $parPage): CursorPaginator
    {
        return RecoveryCase::query()
            ->with(['items' => fn ($q) => $q->whereNull('removed_at')])
            ->when($filtres->status !== null, fn (Builder $q) => $q->where('status', $filtres->status?->value))
            ->when($filtres->leaseId !== null, fn (Builder $q) => $q->where('lease_id', (string) $filtres->leaseId))
            ->when($filtres->debtorPartyId !== null, fn (Builder $q) => $q->where('debtor_party_id', (string) $filtres->debtorPartyId))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $filtres->cursor === null ? null : Cursor::fromEncoded($filtres->cursor));
    }
}
