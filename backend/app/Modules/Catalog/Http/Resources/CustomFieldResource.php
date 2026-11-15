<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Resources;

use App\Modules\Catalog\Models\CustomFieldDefinition;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property CustomFieldDefinition $resource
 */
final class CustomFieldResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $champ = $this->resource;

        return [
            'id' => $champ->id,
            'entity' => $champ->entity->value,
            'key' => $champ->key,
            'labels' => $champ->labels,
            'type' => $champ->type->value,
            'vocabulary' => $champ->vocabulary,
            'options' => $champ->options,
            'required' => $champ->required,
            'position' => $champ->position,
            'type_locked' => $champ->values_recorded_at !== null,
            'archived' => $champ->archived_at !== null,
        ];
    }
}
