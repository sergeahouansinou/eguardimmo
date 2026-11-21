<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Resources\Owner;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property array{id: string, role: string, organization: array{id: string, name: string|null}, mandant: array{name: string}, linked_at: string} $resource
 */
final class OwnerLinkResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return $this->resource;
    }
}
