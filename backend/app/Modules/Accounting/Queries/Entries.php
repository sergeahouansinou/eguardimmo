<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\EntryFilters;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Models\JournalLine;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;

final class Entries
{
    /**
     * @return CursorPaginator<int, JournalEntry>
     */
    public function list(EntryFilters $filtres): CursorPaginator
    {
        return JournalEntry::query()
            ->withCount('lines')
            ->when($filtres->journal !== null, fn (Builder $q): Builder => $q->where('journal', $filtres->journal?->value))
            ->when($filtres->leaseId !== null, fn (Builder $q): Builder => $q->whereIn('id', JournalLine::query()->where('lease_id', $filtres->leaseId)->select('journal_entry_id')))
            ->when($filtres->from !== null, fn (Builder $q): Builder => $q->where('entry_date', '>=', $filtres->from?->format('Y-m-d')))
            ->when($filtres->to !== null, fn (Builder $q): Builder => $q->where('entry_date', '<', $filtres->to?->addDay()->format('Y-m-d')))
            ->orderByDesc('entry_date')
            ->orderByDesc('id')
            ->cursorPaginate($filtres->perPage);
    }

    public function find(string $id): ?JournalEntry
    {
        return JournalEntry::query()->with('lines.account')->find($id);
    }
}
