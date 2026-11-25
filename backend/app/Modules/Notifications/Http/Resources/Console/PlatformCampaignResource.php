<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources\Console;

use App\Modules\Notifications\Enums\PlatformDeliveryStatus;
use App\Modules\Notifications\Models\PlatformCampaignImage;
use App\Modules\Notifications\Support\CampaignHtml;
use App\Modules\Notifications\Support\PlatformCampaignRow;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property PlatformCampaignRow $resource
 */
final class PlatformCampaignResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $campagne = $this->resource->campaign;
        $citees = app(CampaignHtml::class)->citedImages((string) $campagne->html);
        $stats = [];

        foreach (PlatformDeliveryStatus::cases() as $statut) {
            $stats[$statut->value] = $this->resource->counts[$statut->value] ?? 0;
        }

        return [
            ...(new PlatformCampaignSummaryResource($this->resource))->toArray($request),
            'subject' => $campagne->subject,
            'html' => $campagne->html,
            'push_title' => $campagne->push_title,
            'push_body' => $campagne->push_body,
            'link' => $campagne->link,
            'inactivity_days' => $campagne->inactivity_days,
            'recipient_emails' => $this->resource->recipientEmails,
            'images' => $campagne->images->map(fn (PlatformCampaignImage $image): array => [
                'id' => $image->id,
                'name' => $image->name,
                'mime' => $image->mime,
                'size' => $image->size_bytes,
                'url' => route('notifications.console.marketing.campaigns.images.show', ['campaign' => $campagne->id, 'image' => $image->id], false),
                'inline' => in_array($image->id, $citees, true),
            ])->values()->all(),
            'lock_version' => $campagne->lock_version,
            'stats' => [...$stats, 'unsubscribed' => $this->resource->unsubscribed],
        ];
    }
}
