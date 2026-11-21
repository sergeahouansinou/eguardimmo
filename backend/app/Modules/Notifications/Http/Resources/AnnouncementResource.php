<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use App\Modules\Notifications\Support\AnnouncementView;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property AnnouncementView $resource
 */
final class AnnouncementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $a = $this->resource;

        return [
            'id' => $a->campaignId,
            'notification_id' => $a->notificationId,
            'organization_id' => $a->organizationId,
            'organization_name' => $a->organizationName,
            'subject' => $a->subject,
            'body' => $a->body,
            'content_purged' => $a->contentPurged,
            'sent_at' => $a->sentAt?->toIso8601String(),
            'read_at' => $a->readAt?->toIso8601String(),
            'unread' => $a->readAt === null,
            'attachments' => $a->attachments,
        ];
    }
}
