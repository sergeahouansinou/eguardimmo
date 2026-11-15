<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Resources;

use App\Modules\Organizations\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property Organization $resource
 */
final class OrganizationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'kind' => $this->resource->kind->value,
            'name' => $this->resource->name,
            'country' => $this->resource->country,
            'two_factor_required' => $this->resource->two_factor_required,
        ];
    }
}
