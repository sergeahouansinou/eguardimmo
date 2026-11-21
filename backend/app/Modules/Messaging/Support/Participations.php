<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationParticipant;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * La ligne de participant ne porte que l'état de lecture d'un compte ; elle naît à sa première lecture ou à son premier message.
 * Elle n'autorise jamais rien à un locataire ni à un mandant : la clé de lecture est évaluée à chaque requête (ADR 0033).
 */
final class Participations
{
    public static function of(Conversation $conversation, string $userId, MessageSide $cote): ConversationParticipant
    {
        $cle = ['conversation_id' => $conversation->id, 'user_id' => $userId];

        try {
            return ConversationParticipant::query()->where($cle)->first()
                ?? ConversationParticipant::query()->create([...$cle, 'side' => $cote]);
        } catch (UniqueConstraintViolationException) {
            return ConversationParticipant::query()->where($cle)->firstOrFail();
        }
    }
}
