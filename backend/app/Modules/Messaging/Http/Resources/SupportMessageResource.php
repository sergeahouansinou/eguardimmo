<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources;

use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Messaging\Models\SupportTicketMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property SupportTicketMessage $resource
 */
final class SupportMessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $message = $this->resource;

        return [
            'id' => $message->id,
            'author' => ['id' => $message->author_user_id, 'name' => $message->author->name, 'support' => $message->from_support],
            'body' => $message->body,
            'internal' => $message->internal,
            'sent_at' => $message->sent_at->toIso8601String(),
            'attachments' => $message->attachments->map(fn (SupportAttachment $piece): array => [
                'id' => $piece->id,
                'name' => $piece->original_name,
                'mime_type' => $piece->mime_type,
                'size_bytes' => $piece->size_bytes,
            ])->values()->all(),
        ];
    }
}
