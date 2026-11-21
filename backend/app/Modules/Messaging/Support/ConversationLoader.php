<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationParticipant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ConversationLoader
{
    public const int MESSAGES_MAX = 200;

    /**
     * Le fil interne d'un participant avec ses 200 derniers messages au plus (`messages_count` donne le total) : un fil long ne se charge
     * jamais en entier. Les fils avec une contrepartie ne passent jamais par ici.
     */
    public static function participation(Request $request, string $conversationId): ConversationParticipant
    {
        $participation = self::interne($request, $conversationId)
            ->select('conversation_participants.*')
            ->selectSub(DB::table('conversation_messages')->selectRaw('count(*)')->whereColumn('conversation_messages.conversation_id', 'conversation_participants.conversation_id'), 'messages_count')
            ->with([
                'conversation.participants.user',
                'conversation.latestMessage.attachments',
                'conversation.messages' => fn ($requete) => $requete->reorder()->orderByDesc('sent_at')->orderByDesc('id')->limit(self::MESSAGES_MAX),
                'conversation.messages.attachments',
            ])
            ->first() ?? throw ErrorCode::ConversationNotFound->problem();

        $conversation = $participation->conversation;
        $conversation->setRelation('messages', $conversation->messages->reverse()->values());

        return $participation;
    }

    /**
     * Le fil interne d'un participant, sans ses messages : vérifie l'accès avant une écriture.
     */
    public static function conversation(Request $request, string $conversationId): Conversation
    {
        $participation = self::interne($request, $conversationId)->with('conversation')->first();

        return $participation === null ? throw ErrorCode::ConversationNotFound->problem() : $participation->conversation;
    }

    /**
     * @return Builder<ConversationParticipant>
     */
    private static function interne(Request $request, string $conversationId): Builder
    {
        return ConversationParticipant::query()
            ->where('conversation_participants.conversation_id', $conversationId)
            ->where('conversation_participants.user_id', $request->user()?->getAuthIdentifier())
            ->whereHas('conversation', fn (Builder $fil) => $fil->where('conversations.kind', ConversationKind::Internal->value));
    }

    public static function download(Request $request, string $id): StreamedResponse
    {
        $piece = ConversationAttachment::query()->with('message')->find($id);
        $participe = $piece !== null && ConversationParticipant::query()
            ->where('conversation_id', $piece->message->conversation_id)
            ->where('user_id', $request->user()?->getAuthIdentifier())
            ->exists();

        if ($piece === null || ! $participe) {
            throw ErrorCode::AttachmentNotFound->problem();
        }

        return app(AttachmentStreams::class)->stream($piece);
    }
}
