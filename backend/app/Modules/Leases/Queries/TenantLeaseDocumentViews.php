<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseDocument;
use App\Modules\Leases\Support\LeaseDocumentView;
use App\Shared\Tenancy\AcrossOrganizations;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class TenantLeaseDocumentViews
{
    public function __construct(
        private DocumentStore $fichiers,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * Les fichiers se lisent en une requête ; la pièce signée du bail, visible d'office, ouvre la première page.
     *
     * @param  iterable<LeaseDocument>  $documents
     * @return list<LeaseDocumentView>
     */
    public function of(TenantStandingData $position, iterable $documents, bool $avecBailSigne): array
    {
        $documents = array_values([...$documents]);
        $signe = $avecBailSigne ? AcrossOrganizations::query(Lease::class)->whereKey($position->leaseId)->value('signed_file_id') : null;
        $ids = array_map(fn (LeaseDocument $d): string => $d->stored_file_id, $documents);

        if (is_string($signe)) {
            $ids[] = $signe;
        }

        $fichiers = $ids === [] ? [] : $this->contexte->run($position->organizationId, fn (): array => $this->fichiers->findMany($ids));
        $vues = [];

        if (is_string($signe) && isset($fichiers[$signe])) {
            $vues[] = new LeaseDocumentView($signe, LeaseDocumentView::SIGNED_LEASE, $fichiers[$signe]->createdAt, $fichiers[$signe]);
        }

        foreach ($documents as $document) {
            $vues[] = new LeaseDocumentView($document->id, $document->kind->value, $document->shared_at, $fichiers[$document->stored_file_id] ?? null);
        }

        return $vues;
    }

    public function signedFileId(TenantStandingData $position): ?string
    {
        $id = AcrossOrganizations::query(Lease::class)->whereKey($position->leaseId)->value('signed_file_id');

        return is_string($id) ? $id : null;
    }
}
