<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources\Console;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property string $resource adresse de l'opérateur
 */
final class PlatformCampaignTestResource extends JsonResource
{
    /**
     * @return array<string, string>
     */
    public function toArray(Request $request): array
    {
        return ['sent_to' => $this->resource];
    }
}
