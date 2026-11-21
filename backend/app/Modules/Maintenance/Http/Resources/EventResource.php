<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Resources;

use App\Modules\Maintenance\Models\InterventionEvent;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property InterventionEvent $resource
 */
final class EventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $e = $this->resource;

        return [
            'id' => $e->id,
            'kind' => $e->kind->value,
            'actor_kind' => $e->actor_kind->value,
            'text' => $e->text,
            'metadata' => $e->metadata,
            'visible_to_owner' => $e->visible_to_owner,
            'visible_to_tenant' => $e->visible_to_tenant,
            'created_at' => $e->created_at->toIso8601String(),
        ];
    }
}
