<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Resources;

use App\Modules\Catalog\Data\TagData;
use App\Modules\Properties\Support\UnitView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property UnitView $resource
 */
final class UnitResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...(new UnitSummaryResource($this->resource->unit, $this->resource->type))->toArray($request),
            'tags' => array_map(fn (TagData $etiquette): array => [
                'id' => $etiquette->id,
                'name' => $etiquette->name,
                'slug' => $etiquette->slug,
                'color' => $etiquette->color,
            ], $this->resource->tags),
        ];
    }
}
