<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Enums\LibraryKind;
use App\Modules\Documents\Models\LibraryDocument;
use App\Modules\Documents\Support\SubjectGuard;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

final readonly class FileLibraryDocument
{
    public function __construct(
        private SubjectGuard $sujets,
        private StoreFile $stockage,
        private RecordAudit $audit,
    ) {}

    /**
     * Dépose le fichier (analysé par l'antivirus, jamais lisible avant le verdict) et son entrée dans une même transaction.
     */
    public function handle(FileSource $source, string $displayName, LibraryKind $kind, ?DocumentSubject $subject, ?CarbonInterface $retentionUntil): LibraryDocument
    {
        $impose = $kind->requiredSubject();

        if ($impose !== null && $subject?->type !== $impose->value) {
            throw ErrorCode::LibraryKindSubjectMismatch->problem();
        }

        if ($subject !== null) {
            $this->sujets->ensure($subject);
        }

        return DB::transaction(function () use ($source, $displayName, $kind, $subject, $retentionUntil): LibraryDocument {
            $fichier = $this->stockage->handle($source, $displayName, FileCategory::Supporting, $subject, $retentionUntil);
            $auteur = auth()->id();

            $entree = LibraryDocument::query()->create([
                'stored_file_id' => $fichier->id,
                'kind' => $kind,
                'filed_by_user_id' => is_string($auteur) ? $auteur : null,
                'lock_version' => 1,
            ]);

            $this->audit->handle('documents.library.filed', subject: $entree, metadata: ['kind' => $kind->value, 'has_subject' => $subject !== null]);

            return $entree->load('file');
        });
    }
}
