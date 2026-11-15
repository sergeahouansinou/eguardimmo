<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources;

use App\Modules\Messaging\Models\ConversationParticipant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * @property ConversationParticipant $resource
 */
final class ConversationSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $participation = $this->resource;
        $conversation = $participation->conversation;
        $dernier = $conversation->latestMessage;
        $vis = $participation->user_id;
        $autre = $conversation->participants->first(fn (ConversationParticipant $p): bool => $p->user_id !== $vis);

        return [
            'id' => $conversation->id,
            'subject' => $conversation->subject,
            'counterpart' => $autre === null ? null : ['id' => $autre->user_id, 'name' => $autre->user->name],
            'preview' => Str::limit((string) $dernier?->body, 140),
            'last_message_at' => $conversation->last_message_at->toIso8601String(),
            'last_author_id' => $conversation->last_author_user_id,
            'unread' => $conversation->last_author_user_id !== $vis
                && ($participation->last_read_at === null || $participation->last_read_at->lt($conversation->last_message_at)),
            'archived' => $participation->archived_at !== null,
            'awaiting_reply' => $conversation->last_author_user_id !== $vis,
            'message_count' => (int) ($participation->getAttributes()['messages_count'] ?? $conversation->messages->count()),
            'has_attachments' => $dernier !== null && $dernier->attachments->isNotEmpty(),
        ];
    }
}
