<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationParticipant;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ConversationLoader
{
    public static function participation(Request $request, string $conversationId): ConversationParticipant
    {
        return ConversationParticipant::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $request->user()?->getAuthIdentifier())
            ->with(['conversation.participants.user', 'conversation.messages.attachments', 'conversation.latestMessage.attachments'])
            ->first() ?? throw ErrorCode::ConversationNotFound->problem();
    }

    public static function download(Request $request, string $id): StreamedResponse
    {
        $piece = ConversationAttachment::query()->with('message')->find($id);
        $participe = $piece !== null && ConversationParticipant::query()
            ->where('conversation_id', $piece->message->conversation_id)
            ->where('user_id', $request->user()?->getAuthIdentifier())
            ->exists();

        if ($piece === null || ! $participe || ! AttachmentStore::exists($piece->path)) {
            throw ErrorCode::AttachmentNotFound->problem();
        }

        return AttachmentStore::response($piece->path, $piece->original_name, $piece->mime_type);
    }
}
