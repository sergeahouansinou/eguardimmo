<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Models\ConversationAttachment;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Support\Str;

final class ThreadAttachments
{
    /**
     * La pièce et le fil qui la porte, sans contexte d'organisation : l'appelant vérifie ensuite que le fil est dans sa clé.
     */
    public function find(string $id): ?ConversationAttachment
    {
        if (! Str::isUuid($id)) {
            return null;
        }

        return AcrossOrganizations::query(ConversationAttachment::class)
            ->join('conversation_messages', 'conversation_messages.id', '=', 'conversation_attachments.conversation_message_id')
            ->where('conversation_attachments.id', $id)
            ->first(['conversation_attachments.*', 'conversation_messages.conversation_id as conversation_id']);
    }
}
