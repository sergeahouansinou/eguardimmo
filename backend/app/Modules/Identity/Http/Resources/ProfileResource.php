<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources;

use App\Modules\Identity\Data\ProfileData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property ProfileData $resource
 */
final class ProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'space' => $this->resource->space->value,
            'label' => $this->resource->label,
            'meta' => (object) $this->resource->meta,
        ];
    }
}
