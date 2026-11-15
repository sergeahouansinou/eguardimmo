<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Resources;

use App\Modules\Catalog\Enums\VocabularyKey;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property VocabularyKey $resource
 */
final class VocabularyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $vocabulaire = $this->resource;

        return [
            'key' => $vocabulaire->value,
            'title' => $vocabulaire->title(),
            'extensible' => $vocabulaire->extensible(),
            'hierarchical' => $vocabulaire->hierarchical(),
            'semantic_keys' => $vocabulaire->semantics(),
            'semantic_required' => $vocabulaire->semanticRequired(),
            'metadata_keys' => array_values(array_filter(array_keys($vocabulaire->metadataRules()), fn (string $cle): bool => ! str_contains($cle, '.'))),
        ];
    }
}
