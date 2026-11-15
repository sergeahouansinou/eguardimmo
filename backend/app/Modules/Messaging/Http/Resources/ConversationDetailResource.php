<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources;

use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Models\ConversationParticipant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property ConversationParticipant $resource
 */
final class ConversationDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $conversation = $this->resource->conversation;

        return [
            ...(new ConversationSummaryResource($this->resource))->toArray($request),
            'viewer_id' => $this->resource->user_id,
            'participants' => $conversation->participants->map(fn (ConversationParticipant $p): array => ['id' => $p->user_id, 'name' => $p->user->name])->values()->all(),
            'messages' => $conversation->messages->map(fn (ConversationMessage $m): array => [
                'id' => $m->id,
                'author_id' => $m->author_user_id,
                'body' => $m->body,
                'sent_at' => $m->sent_at->toIso8601String(),
                'attachments' => $m->attachments->map(fn (ConversationAttachment $a): array => [
                    'id' => $a->id, 'name' => $a->original_name, 'mime_type' => $a->mime_type, 'size_bytes' => $a->size_bytes,
                ])->values()->all(),
            ])->values()->all(),
        ];
    }
}
