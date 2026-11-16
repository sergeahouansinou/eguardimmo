<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Resources;

use App\Modules\Catalog\Data\TagData;
use App\Modules\Properties\Support\PropertyView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property PropertyView $resource
 */
final class PropertyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $site = $this->resource->property;

        return [
            ...(new PropertySummaryResource($site))->toArray($request),
            'custom_fields' => (object) $site->custom_fields,
            'lock_version' => $site->lock_version,
            'tags' => array_map(fn (TagData $etiquette): array => [
                'id' => $etiquette->id,
                'name' => $etiquette->name,
                'slug' => $etiquette->slug,
                'color' => $etiquette->color,
            ], $this->resource->tags ?? []),
        ];
    }
}
