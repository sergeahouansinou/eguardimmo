<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property array{id: string, organization: array{id: string, name: string|null}} $resource
 */
final class TenantLinkResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return $this->resource;
    }
}
