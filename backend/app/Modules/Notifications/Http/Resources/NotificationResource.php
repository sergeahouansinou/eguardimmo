<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Resources;

use App\Modules\Notifications\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Forme attendue par le menu de notifications du shell : id, tone, title, detail, unread, href.
 *
 * @property Notification $resource
 */
final class NotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $n = $this->resource;

        return [
            'id' => $n->id,
            'type' => $n->type->value,
            'tone' => $n->type->tone(),
            'title' => $n->title,
            'detail' => $n->body,
            'unread' => $n->read_at === null,
            'href' => $n->link,
            'organization_id' => $n->organization_id,
            'created_at' => $n->created_at->toIso8601String(),
            'read_at' => $n->read_at?->toIso8601String(),
        ];
    }
}
