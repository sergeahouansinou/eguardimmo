<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources\Console;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Périmètre `settings`.
 *
 * @property array{id: string, name: string, country: string, currency: string} $resource
 */
final class OrganizationSettingsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return $this->resource;
    }
}
