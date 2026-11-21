<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources\Organization;

use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property array{message: ConversationMessage, viewer: string} $resource
 */
final class ExternalMessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $message = $this->resource['message'];
        $moi = $message->author_user_id === $this->resource['viewer'];

        return [
            'id' => $message->id,
            'client_id' => $moi ? $message->client_id : null,
            'author' => ['id' => $message->author_user_id, 'name' => $message->author->name, 'side' => $message->author_side->value],
            'mine' => $moi,
            'body' => $message->body,
            'sent_at' => $message->sent_at->toIso8601String(),
            'redacted' => $message->isRedacted(),
            'redacted_at' => $message->redacted_at?->toIso8601String(),
            'redaction_reason' => $message->redaction_reason,
            'attachments' => $message->attachments->map(fn (ConversationAttachment $a): array => [
                'id' => $a->id, 'name' => $a->original_name, 'mime_type' => $a->mime_type, 'size_bytes' => $a->size_bytes,
            ])->values()->all(),
        ];
    }
}
