<?php

declare(strict_types=1);

namespace App\Modules\Documents\Queries;

use App\Modules\Documents\Data\LibraryFilters;
use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Models\LibraryDocument;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * La bibliothèque ne liste que les dépôts volontaires, jamais l'ensemble des fichiers stockés.
 */
final readonly class LibraryEntries
{
    /**
     * @return CursorPaginator<int, LibraryDocument>
     */
    public function page(LibraryFilters $filtres, int $parPage, ?string $curseur): CursorPaginator
    {
        return LibraryDocument::query()
            ->with('file')
            ->when($filtres->archived, fn (Builder $q) => $q->whereNotNull('archived_at'), fn (Builder $q) => $q->whereNull('archived_at'))
            ->when($filtres->kind !== null, fn (Builder $q) => $q->where('kind', $filtres->kind?->value))
            ->when($filtres->subject !== null, fn (Builder $q) => $q->whereHas('file', fn (Builder $f) => $f
                ->where('subject_type', $filtres->subject?->type)->where('subject_id', $filtres->subject?->id)))
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    public function get(string $id, bool $lock = false): LibraryDocument
    {
        $requete = LibraryDocument::query()->with('file')->whereKey(Str::isUuid($id) ? $id : null);

        return ($lock ? $requete->lockForUpdate() : $requete)->first() ?? throw ErrorCode::LibraryDocumentNotFound->problem();
    }
}
