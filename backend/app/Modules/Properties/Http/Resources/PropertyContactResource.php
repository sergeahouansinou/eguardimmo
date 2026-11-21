<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Resources;

use App\Modules\Properties\Data\PropertyContactData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property PropertyContactData $resource
 */
final class PropertyContactResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $d = $this->resource;
        $categorie = $d->category;

        return [
            'id' => $d->id,
            'property_id' => $d->propertyId,
            'property_name' => $d->propertyName,
            'unit_id' => $d->unitId,
            'unit_reference' => $d->unitReference,
            'party' => [
                'id' => $d->partyId,
                'display_name' => $d->partyName,
                'kind' => $d->partyKind,
                'is_anonymized' => $d->partyAnonymized,
            ],
            'category' => $categorie === null ? null : [
                'id' => $categorie->id,
                'key' => $categorie->key,
                'label' => $categorie->label(),
                'semantic_key' => $categorie->semanticKey,
            ],
            'created_at' => $d->createdAt->toIso8601String(),
        ];
    }
}
