<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Data\InstallmentFilters;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;

final readonly class InstallmentList
{
    /**
     * Tri par identifiant UUID v7 décroissant, comme les autres listes : l'ordre de génération, sans date dans le curseur.
     *
     * @return CursorPaginator<int, Installment>
     */
    public function list(InstallmentFilters $filtres, int $parPage, CarbonImmutable $today): CursorPaginator
    {
        return Installment::query()
            ->with(['notice', 'receipt'])
            ->when($filtres->leaseId !== null, fn (Builder $q) => $q->where('lease_id', (string) $filtres->leaseId))
            ->when($filtres->status !== null, fn (Builder $q) => $q->where('status', $filtres->status?->value))
            ->when($filtres->dueFrom !== null, fn (Builder $q) => $q->where('due_date', '>=', (string) $filtres->dueFrom))
            ->when($filtres->dueTo !== null, fn (Builder $q) => $q->where('due_date', '<=', (string) $filtres->dueTo))
            ->when($filtres->overdue, fn (Builder $q) => $q
                ->whereIn('status', array_map(fn (InstallmentStatus $s): string => $s->value, InstallmentStatus::open()))
                ->where('due_date', '<', $today->toDateString()))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $filtres->cursor === null ? null : Cursor::fromEncoded($filtres->cursor));
    }
}
