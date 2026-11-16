<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Resources;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Properties\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property Unit $resource
 */
final class UnitSummaryResource extends JsonResource
{
    public function __construct(Unit $unit, private readonly TermData $type)
    {
        parent::__construct($unit);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $lot = $this->resource;

        return [
            'id' => $lot->id,
            'property' => ['id' => $lot->property_id, 'name' => $lot->property->name],
            'parent_unit_id' => $lot->parent_unit_id,
            'unit_type' => [
                'id' => $this->type->id,
                'key' => $this->type->key,
                'label' => $this->type->label(),
                'semantic_key' => $this->type->semanticKey,
            ],
            'reference' => $lot->reference,
            'floor' => $lot->floor,
            'surface_hundredths' => $lot->surface_hundredths,
            'characteristics' => (object) $lot->characteristics,
            'custom_fields' => (object) $lot->custom_fields,
            'lock_version' => $lot->lock_version,
            'archived_at' => $lot->archived_at?->toIso8601String(),
        ];
    }
}
