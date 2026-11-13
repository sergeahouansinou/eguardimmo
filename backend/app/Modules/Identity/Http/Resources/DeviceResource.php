<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Resources;

use App\Modules\Identity\Models\PersonalAccessToken;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property PersonalAccessToken $resource
 */
final class DeviceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $courant = $request->user()?->currentAccessToken();

        return [
            'id' => $this->resource->id,
            'name' => $this->resource->name,
            'last_used_at' => $this->resource->last_used_at?->toIso8601String(),
            'created_at' => $this->resource->created_at?->toIso8601String(),
            'expires_at' => $this->resource->expires_at?->toIso8601String(),
            'current' => $courant instanceof PersonalAccessToken && $courant->id === $this->resource->id,
        ];
    }
}
