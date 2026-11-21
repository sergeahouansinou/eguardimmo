<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Resources;

use App\Modules\Organizations\Data\ActivityEntryData;
use App\Modules\Organizations\Support\ActivityShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ligne de la liste, pour `owner` et `admin` : origine tronquée, appareil réduit, sans différentiel.
 *
 * @property ActivityEntryData $resource
 */
final class ActivityRowResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $e = $this->resource;

        return [
            'id' => $e->id,
            'occurred_at' => $e->occurredAt->toIso8601String(),
            'type' => $e->type->value,
            'label' => $e->label,
            'action' => $e->action,
            'actor' => ActivityShape::actor($e),
            'subject' => ActivityShape::subject($e),
            'ip' => $e->ip,
            'device' => $e->device,
        ];
    }
}
