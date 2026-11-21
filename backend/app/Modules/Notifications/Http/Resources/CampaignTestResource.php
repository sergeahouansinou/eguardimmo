<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property array{sent_to: string, subject: string, sent_at: CarbonImmutable} $resource
 */
final class CampaignTestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return ['sent_to' => $this->resource['sent_to'], 'subject' => $this->resource['subject'], 'sent_at' => $this->resource['sent_at']->toIso8601String()];
    }
}
