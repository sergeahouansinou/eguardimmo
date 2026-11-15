<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Resources;

use App\Modules\Documents\Data\StoredFileData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property StoredFileData $resource
 */
final class StoredFileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $fichier = $this->resource;

        return [
            'id' => $fichier->id,
            'name' => $fichier->displayName,
            'mime_type' => $fichier->mimeType,
            'size_bytes' => $fichier->sizeBytes,
            'sha256' => $fichier->sha256,
            'category' => $fichier->category->value,
            'subject' => $fichier->subject === null ? null : ['type' => $fichier->subject->type, 'id' => $fichier->subject->id],
            'retention_until' => $fichier->retentionUntil?->toIso8601String(),
            'created_at' => $fichier->createdAt->toIso8601String(),
        ];
    }
}
