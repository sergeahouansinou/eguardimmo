<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Resources;

use App\Modules\Inspections\Models\Inspection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Inspection
 */
final class InspectionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'lease_id' => $this->lease_id,
            'kind' => $this->kind->value,
            'performed_on' => $this->performed_on->toDateString(),
            'performed_by' => $this->performed_by->value,
            'signatories' => $this->signatories,
            'exit_matches_entry' => $this->exit_matches_entry,
            'stored_file_id' => $this->stored_file_id,
            'published_at' => $this->published_at?->toIso8601String(),
            'published_by_user_id' => $this->published_by_user_id,
            'created_by_user_id' => $this->created_by_user_id,
            'lock_version' => $this->lock_version,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
