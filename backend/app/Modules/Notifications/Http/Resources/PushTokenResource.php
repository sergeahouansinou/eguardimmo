<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use App\Modules\Notifications\Models\PushToken;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Le jeton d'appareil n'est jamais renvoyé, même à son propriétaire.
 *
 * @property PushToken $resource
 */
final class PushTokenResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'platform' => $this->resource->platform->value,
            'device_name' => $this->resource->device_name,
            'registered_at' => $this->resource->updated_at->toIso8601String(),
        ];
    }
}
