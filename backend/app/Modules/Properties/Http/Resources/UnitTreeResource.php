<?php

declare(strict_types=1);

namespace App\Modules\Properties\Http\Resources;

use App\Modules\Properties\Support\UnitNode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property UnitNode $resource
 */
final class UnitTreeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...(new UnitSummaryResource($this->resource->unit, $this->resource->type))->toArray($request),
            'annexes' => array_map(fn (UnitNode $noeud): array => (new self($noeud))->toArray($request), $this->resource->annexes),
        ];
    }
}
