<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources\Tenant;

use App\Modules\Leases\Support\LeaseDocumentView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin LeaseDocumentView
 */
final class TenantLeaseDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'shared_at' => $this->sharedAt?->toIso8601String(),
            'file' => $this->file === null ? null : [
                'name' => $this->file->displayName,
                'mime_type' => $this->file->mimeType,
                'size_bytes' => $this->file->sizeBytes,
            ],
        ];
    }
}
