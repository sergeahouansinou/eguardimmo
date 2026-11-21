<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use App\Modules\Notifications\Support\CampaignView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property CampaignView $resource
 */
final class CampaignResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $c = $this->resource->campaign;

        return [
            'id' => $c->id,
            'subject' => $c->subject,
            'body' => $c->body,
            'audience' => $c->audience->value,
            'audience_label' => $c->audience->label(),
            'building_ids' => $c->building_ids,
            'status' => $c->status->value,
            'copy_to_history' => $c->copy_to_history,
            'scheduled_at' => $c->scheduled_at?->toIso8601String(),
            'sending_started_at' => $c->sending_started_at?->toIso8601String(),
            'sent_at' => $c->sent_at?->toIso8601String(),
            'cancelled_at' => $c->cancelled_at?->toIso8601String(),
            'content_purged' => $c->content_purged_at !== null,
            'recipient_count' => $c->recipient_count,
            'failed_count' => $c->failed_count,
            'metrics' => $this->resource->metrics,
            'attachments' => $this->resource->attachments,
            'created_by_user_id' => $c->created_by_user_id,
            'lock_version' => $c->lock_version,
            'created_at' => $c->created_at->toIso8601String(),
            'updated_at' => $c->updated_at->toIso8601String(),
        ];
    }
}
