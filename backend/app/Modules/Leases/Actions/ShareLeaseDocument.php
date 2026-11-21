<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseDocumentKind;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Events\LeaseDocumentShared;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseDocument;
use App\Modules\Leases\Models\LeaseParty;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ShareLeaseDocument
{
    public function __construct(
        private DocumentStore $fichiers,
        private RecordAudit $audit,
    ) {}

    public function handle(Lease $lease, User $auteur, string $storedFileId, LeaseDocumentKind $kind, ?string $partyId): LeaseDocument
    {
        if ($lease->status === LeaseStatus::Draft || $lease->status === LeaseStatus::Cancelled) {
            throw ErrorCode::LeaseNotSigned->problem();
        }

        $fichier = $this->fichiers->find($storedFileId);

        if ($fichier === null) {
            throw ErrorCode::LeaseDocumentInvalid->problem('Ce fichier n\'existe pas dans votre organisation.');
        }

        $deposeCePourCeBail = $fichier->subject?->type === 'lease' && $fichier->subject->id === $lease->id
            && in_array($fichier->category, [FileCategory::Supporting, FileCategory::Certificate], true);

        if (! $deposeCePourCeBail) {
            throw ErrorCode::LeaseDocumentInvalid->problem('Seul un fichier téléversé pour ce bail peut être partagé.');
        }

        if ($partyId !== null && ! LeaseParty::query()->where('lease_id', $lease->id)->where('party_id', $partyId)->where('role', LeasePartyRole::Tenant->value)->exists()) {
            throw ErrorCode::LeaseDocumentInvalid->problem('Cette fiche n\'est pas locataire de ce bail.');
        }

        return DB::transaction(function () use ($lease, $auteur, $storedFileId, $kind, $partyId): LeaseDocument {
            $document = LeaseDocument::query()->create([
                'lease_id' => $lease->id,
                'party_id' => $partyId,
                'stored_file_id' => $storedFileId,
                'kind' => $kind,
                'shared_by_user_id' => $auteur->id,
                'shared_at' => now(),
            ]);

            $this->audit->handle('leases.document.shared', subject: $document, metadata: ['kind' => $kind->value, 'targeted' => $partyId !== null]);
            LeaseDocumentShared::dispatch($document->id, $lease->id, $lease->organization_id, $partyId);

            return $document;
        });
    }
}
