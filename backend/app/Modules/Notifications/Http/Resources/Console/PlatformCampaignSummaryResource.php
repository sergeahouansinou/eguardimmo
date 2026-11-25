<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources\Console;

use App\Modules\Notifications\Enums\MarketingChannel;
use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Modules\Notifications\Support\PlatformCampaignRow;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property PlatformCampaignRow $resource
 */
final class PlatformCampaignSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $campagne = $this->resource->campaign;
        $compte = fn (callable $filtre): int => array_sum(array_map(
            fn (PlatformDeliveryStatus $statut): int => $this->resource->counts[$statut->value] ?? 0,
            array_filter(PlatformDeliveryStatus::cases(), $filtre),
        ));

        return [
            'id' => $campagne->id,
            'channel' => $campagne->channel->value,
            'category' => $campagne->category->value,
            'title' => $campagne->channel === MarketingChannel::Email ? $campagne->subject : $campagne->push_title,
            'audience' => $campagne->audience->value,
            'audience_label' => $campagne->audience->label(),
            'status' => $campagne->status->value,
            'recipient_count' => $campagne->recipient_count,
            'sent_count' => $this->resource->counts[PlatformDeliveryStatus::Sent->value] ?? 0,
            'failed_count' => $compte(fn (PlatformDeliveryStatus $statut): bool => $statut->isFailure()),
            'skipped_count' => $compte(fn (PlatformDeliveryStatus $statut): bool => $statut->isSkipped()),
            'created_at' => $campagne->created_at->toIso8601String(),
            'sent_at' => $campagne->sent_at?->toIso8601String(),
        ];
    }
}
