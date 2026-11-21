<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Resources;

use App\Modules\Organizations\Data\ActivityEntryData;
use App\Modules\Organizations\Support\ActivityShape;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Historique d'une entité pour `manager` : ni différentiel, ni origine, ni appareil, ni référence.
 *
 * @property ActivityEntryData $resource
 */
final class ActivityHistoryResource extends JsonResource
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
            'actor' => ActivityShape::actor($e),
            'subject' => ActivityShape::subject($e),
        ];
    }
}
