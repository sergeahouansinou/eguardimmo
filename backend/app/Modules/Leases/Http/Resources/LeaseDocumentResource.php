<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Resources;

use App\Modules\Leases\Models\LeaseDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin LeaseDocument
 */
final class LeaseDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'lease_id' => $this->lease_id,
            'party_id' => $this->party_id,
            'stored_file_id' => $this->stored_file_id,
            'kind' => $this->kind->value,
            'shared_by_user_id' => $this->shared_by_user_id,
            'shared_at' => $this->shared_at->toIso8601String(),
            'revoked_at' => $this->revoked_at?->toIso8601String(),
        ];
    }
}
