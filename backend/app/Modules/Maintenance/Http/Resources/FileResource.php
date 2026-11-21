<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Models\InterventionFile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property InterventionFile $resource
 */
final class FileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $f = $this->resource;

        return [
            'id' => $f->id,
            'intervention_id' => $f->intervention_id,
            'kind' => $f->kind->value,
            'uploaded_by_kind' => $f->uploaded_by_kind->value,
            'visible_to_owner' => $f->visible_to_owner,
            'visible_to_tenant' => $f->visible_to_tenant,
            'created_at' => $f->created_at?->toIso8601String(),
        ];
    }
}
