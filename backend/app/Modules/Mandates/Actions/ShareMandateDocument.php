<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Mandates\Enums\DocumentUploader;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateDocumentKind;
use App\Modules\Mandates\Events\MandateDocumentShared;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateDocument;
use App\Modules\Mandates\Support\MandateAuthor;
use App\Modules\Mandates\Support\MandateFileGuard;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ShareMandateDocument
{
    public function __construct(
        private MandateFileGuard $fichiers,
        private MandateAuthor $auteur,
        private RecordAudit $audit,
    ) {}

    /**
     * Le fichier doit avoir été téléversé pour ce mandat et être sain. Un fichier déjà partagé et non retiré ne se partage pas deux fois.
     */
    public function handle(Mandate $mandate, string $storedFileId, MandateDocumentKind $kind): MandateDocument
    {
        if ($mandate->archived_at !== null) {
            throw ErrorCode::MandateArchived->problem();
        }

        $this->fichiers->assertDepositedFor($mandate, $storedFileId, [FileCategory::Supporting, FileCategory::Certificate], ErrorCode::MandateDocumentInvalid);

        return DB::transaction(function () use ($mandate, $storedFileId, $kind): MandateDocument {
            Mandate::query()->whereKey($mandate->id)->lockForUpdate()->firstOrFail();

            $existant = MandateDocument::query()
                ->where('mandate_id', $mandate->id)->where('stored_file_id', $storedFileId)->whereNull('revoked_at')->first();

            if ($existant !== null) {
                return $existant;
            }

            $document = MandateDocument::query()->create([
                'mandate_id' => $mandate->id,
                'stored_file_id' => $storedFileId,
                'kind' => $kind,
                'uploaded_by_kind' => DocumentUploader::Agency,
                'shared_by_user_id' => $this->auteur->id(),
                'shared_at' => now(),
            ]);

            $this->audit->handle('mandates.document.shared', subject: $document, metadata: ['kind' => $kind->value]);
            MandateDocumentShared::dispatch($document->id, $mandate->id, $mandate->organization_id, $mandate->mandant_party_id);

            return $document;
        });
    }
}
