<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use App\Modules\Parties\Models\ContactPoint;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property ContactPoint $resource
 */
final class ContactPointResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'type' => $this->resource->type->value,
            'value' => $this->resource->value,
            'label' => $this->resource->label,
            'is_primary' => $this->resource->is_primary,
        ];
    }
}
