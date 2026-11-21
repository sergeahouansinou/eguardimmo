<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property array{id: string, name: string, size_bytes: int} $resource
 */
final class CampaignAttachmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return ['id' => $this->resource['id'], 'name' => $this->resource['name'], 'size_bytes' => $this->resource['size_bytes']];
    }
}
