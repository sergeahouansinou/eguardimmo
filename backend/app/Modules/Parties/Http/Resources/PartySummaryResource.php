<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use App\Modules\Parties\Enums\ContactPointType;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Ligne de liste : la collection charge seulement les coordonnées principales.
 *
 * @property Party $resource
 */
final class PartySummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $principal = fn (ContactPointType $type): ?string => $this->resource->contactPoints
            ->first(fn (ContactPoint $point): bool => $point->type === $type)?->value;

        return [
            'id' => $this->resource->id,
            'kind' => $this->resource->kind->value,
            'display_name' => $this->resource->display_name,
            'primary_email' => $principal(ContactPointType::Email),
            'primary_phone' => $principal(ContactPointType::Phone),
            'is_anonymized' => $this->resource->isAnonymized(),
            'archived_at' => $this->resource->archived_at?->toIso8601String(),
        ];
    }
}
