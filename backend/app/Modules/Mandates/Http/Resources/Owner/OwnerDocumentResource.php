<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources\Owner;

use App\Modules\Mandates\Support\OwnerDocumentView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Jamais l'identifiant du fichier stocké ni l'auteur du partage : le téléchargement passe par l'identifiant de la pièce.
 *
 * @property OwnerDocumentView $resource
 */
final class OwnerDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $document = $this->resource->document;
        $fichier = $this->resource->file;

        return [
            'id' => $document->id,
            'kind' => $document->kind->value,
            'name' => $fichier?->displayName,
            'mime_type' => $fichier?->mimeType,
            'size_bytes' => $fichier?->sizeBytes,
            'shared_at' => $document->shared_at?->toIso8601String(),
            'uploaded_by' => $document->uploaded_by_kind->value,
            'mandate' => ['reference' => $this->resource->mandateReference],
            'agency' => ['id' => $document->organization_id, 'name' => $this->resource->agencyName],
            'mandant' => ['name' => $this->resource->visible?->mandantName],
        ];
    }
}
