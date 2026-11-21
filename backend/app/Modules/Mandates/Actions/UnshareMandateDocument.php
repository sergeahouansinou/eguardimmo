<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateDocumentKind;
use App\Modules\Mandates\Models\MandateDocument;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class UnshareMandateDocument
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Le fichier reste stocké ; un retrait déjà fait ne se rejoue pas.
     */
    public function handle(MandateDocument $document): MandateDocument
    {
        if ($document->kind === MandateDocumentKind::Amendment) {
            throw ErrorCode::MandateAmendmentDocumentLocked->problem();
        }

        if ($document->revoked_at !== null) {
            return $document;
        }

        return DB::transaction(function () use ($document): MandateDocument {
            $document->forceFill(['revoked_at' => now()])->save();
            $this->audit->handle('mandates.document.unshared', subject: $document, metadata: ['kind' => $document->kind->value]);

            return $document;
        });
    }
}
