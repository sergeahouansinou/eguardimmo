<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Resources\Console;

use App\Modules\Subscriptions\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Plan
 */
final class PlanResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'versions' => PlanVersionResource::collection($this->versions->sortByDesc('version')->values()),
        ];
    }
}
