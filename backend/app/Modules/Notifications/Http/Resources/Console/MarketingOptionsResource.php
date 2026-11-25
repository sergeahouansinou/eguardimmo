<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources\Console;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property array<string, mixed> $resource
 */
final class MarketingOptionsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return $this->resource;
    }
}
