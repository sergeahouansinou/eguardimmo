<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Resources\Counterpart;

use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Message vu du locataire ou du mandant : le prénom et le nom du membre de l'équipe qui écrit (ADR 0033, décision 14),
 * jamais un identifiant de compte ni de fiche.
 *
 * @property array{message: ConversationMessage, viewer: string} $resource
 */
final class CounterpartMessageResource extends JsonResource
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
            'author' => [
                'side' => $message->author_side === MessageSide::Staff ? 'agency' : ($moi ? 'me' : 'other'),
                'name' => $message->author->name,
            ],
            'mine' => $moi,
            'body' => $message->body,
            'sent_at' => $message->sent_at->toIso8601String(),
            'redacted' => $message->isRedacted(),
            'attachments' => $message->attachments->map(fn (ConversationAttachment $a): array => [
                'id' => $a->id, 'name' => $a->original_name, 'mime_type' => $a->mime_type, 'size_bytes' => $a->size_bytes,
            ])->values()->all(),
        ];
    }
}
