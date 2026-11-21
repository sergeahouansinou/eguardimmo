<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Models\LibraryDocument;
use App\Modules\Documents\Queries\LibraryEntries;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ArchiveLibraryDocument
{
    public function __construct(
        private LibraryEntries $entrees,
        private RecordAudit $audit,
    ) {}

    /**
     * Ne supprime rien. Une entrée déjà dans l'état demandé est rendue telle quelle, sans nouvelle version ni nouvelle ligne de journal.
     */
    public function handle(string $id, bool $archiver): LibraryDocument
    {
        return DB::transaction(function () use ($id, $archiver): LibraryDocument {
            $entree = $this->entrees->get($id, lock: true);

            if (($entree->archived_at !== null) === $archiver) {
                return $entree;
            }

            $entree->archived_at = $archiver ? now() : null;
            $entree->lock_version = $entree->lock_version + 1;
            $entree->save();

            $this->audit->handle($archiver ? 'documents.library.archived' : 'documents.library.restored', subject: $entree, metadata: ['kind' => $entree->kind->value]);

            return $entree;
        });
    }
}
