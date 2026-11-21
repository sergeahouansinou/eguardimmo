<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Resources;

use App\Modules\Documents\Models\LibraryDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin LibraryDocument
 */
final class LibraryDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $fichier = $this->file;

        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'archived_at' => $this->archived_at?->toIso8601String(),
            'filed_by_user_id' => $this->filed_by_user_id,
            'lock_version' => $this->lock_version,
            'created_at' => $this->created_at->toIso8601String(),
            'file' => [
                'id' => $fichier->id,
                'name' => $fichier->display_name,
                'mime_type' => $fichier->mime_type,
                'size_bytes' => $fichier->size_bytes,
                'scan_status' => $fichier->scan_status->value,
                'subject' => $fichier->subject_type === null ? null : ['type' => $fichier->subject_type, 'id' => $fichier->subject_id],
                'retention_until' => $fichier->retention_until?->toIso8601String(),
            ],
        ];
    }
}
