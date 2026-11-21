<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Models\MandateDocument;
use App\Modules\Mandates\Support\OwnerDocumentView;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class OwnerDocumentViews
{
    public function __construct(
        private DocumentStore $fichiers,
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
    ) {}

    /**
     * @param  iterable<MandateDocument>  $documents
     * @return list<OwnerDocumentView> dans l'ordre reçu
     */
    public function of(OwnerScopeData $portee, iterable $documents): array
    {
        $documents = array_values([...$documents]);
        $noms = $this->organisations->names(array_values(array_unique(array_map(fn (MandateDocument $d): string => $d->organization_id, $documents))));
        $parOrganisation = [];

        foreach ($documents as $document) {
            $parOrganisation[$document->organization_id][] = $document;
        }

        $fichiers = [];
        $references = [];

        foreach ($parOrganisation as $organisationId => $groupe) {
            $this->contexte->run($organisationId, function () use ($groupe, &$fichiers, &$references): void {
                $fichiers += $this->fichiers->findMany(array_map(fn (MandateDocument $d): string => $d->stored_file_id, $groupe));
                $mandats = (new MandateDocument)->newCollection($groupe)->load('mandate:id,organization_id,reference,mandant_party_id');

                foreach ($mandats as $document) {
                    $references[$document->id] = $document->mandate;
                }
            });
        }

        return array_map(fn (MandateDocument $document): OwnerDocumentView => new OwnerDocumentView(
            document: $document,
            file: $fichiers[$document->stored_file_id] ?? null,
            mandateReference: ($references[$document->id] ?? null)?->reference,
            agencyName: $noms[$document->organization_id] ?? null,
            visible: ($mandat = $references[$document->id] ?? null) === null ? null : $portee->visible($document->organization_id, $mandat->mandant_party_id),
        ), $documents);
    }
}
