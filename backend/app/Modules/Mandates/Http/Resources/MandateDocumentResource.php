<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Resources;

use App\Modules\Mandates\Models\MandateDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin MandateDocument
 */
final class MandateDocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'mandate_id' => $this->mandate_id,
            'stored_file_id' => $this->stored_file_id,
            'kind' => $this->kind->value,
            'uploaded_by_kind' => $this->uploaded_by_kind->value,
            'shared_by_user_id' => $this->shared_by_user_id,
            'shared_at' => $this->shared_at?->toIso8601String(),
            'revoked_at' => $this->revoked_at?->toIso8601String(),
        ];
    }
}
