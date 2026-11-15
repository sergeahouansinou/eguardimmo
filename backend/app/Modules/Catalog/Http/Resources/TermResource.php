<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Resources;

use App\Modules\Catalog\Data\TermData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property TermData $resource
 */
final class TermResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $valeur = $this->resource;

        return [
            'id' => $valeur->id,
            'vocabulary' => $valeur->vocabulary,
            'key' => $valeur->key,
            'labels' => $valeur->labels,
            'semantic_key' => $valeur->semanticKey,
            'parent_id' => $valeur->parentId,
            'position' => $valeur->position,
            'metadata' => (object) $valeur->metadata,
            'platform' => $valeur->isPlatform,
            'system' => $valeur->isSystem,
            'archived' => $valeur->isArchived,
            'hidden' => $valeur->isHidden,
            'overridden' => $valeur->isOverridden,
        ];
    }
}
