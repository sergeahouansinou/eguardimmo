<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Support\AttachmentPurger;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Efface les textes et les pièces d'une contrepartie anonymisée (RGPD) : les lignes restent, le texte devient `[effacé]`, ainsi que le
 * sujet des fils qu'elle a ouverts et le motif de restriction. Les messages de l'équipe ne changent pas. Suppose le contexte de l'organisation ; rejouable.
 */
final readonly class ErasePartyMessages
{
    public const string TEXTE = '[effacé]';

    public function __construct(
        private AttachmentPurger $pieces,
        private RecordAudit $audit,
    ) {}

    public function handle(string $partyId): int
    {
        return DB::transaction(function () use ($partyId): int {
            $fils = Conversation::query()->where('party_id', $partyId)->orderBy('id')->lockForUpdate()->get();

            if ($fils->isEmpty()) {
                return 0;
            }

            $messages = ConversationMessage::query()
                ->whereIn('conversation_id', $fils->modelKeys())
                ->where('author_side', '!=', MessageSide::Staff->value)
                ->where('body', '!=', self::TEXTE)
                ->lockForUpdate()
                ->get();

            foreach ($messages as $message) {
                foreach (ConversationAttachment::query()->where('conversation_message_id', $message->id)->get() as $piece) {
                    $this->pieces->purge($piece);
                }

                $message->forceFill(['body' => self::TEXTE, 'redacted_at' => $message->redacted_at ?? now(), 'redaction_reason' => null])->save();
            }

            $sujets = 0;

            foreach ($fils as $fil) {
                $sujets += $this->effacerSujet($fil) ? 1 : 0;
            }

            if ($messages->isNotEmpty() || $sujets > 0) {
                $this->audit->handle('messaging.messages.erased', subject: $fils->first(), metadata: ['messages' => $messages->count(), 'subjects' => $sujets]);
            }

            return $messages->count();
        });
    }

    private function effacerSujet(Conversation $fil): bool
    {
        $premier = ConversationMessage::query()->where('conversation_id', $fil->id)->orderBy('sent_at')->orderBy('id')->first();
        $ouvertParLaContrepartie = $premier !== null && $premier->author_side !== MessageSide::Staff;
        $sujet = $ouvertParLaContrepartie && $fil->subject !== self::TEXTE;
        $motif = $fil->counterpart_muted_reason !== null;

        if ($sujet || $motif) {
            $fil->forceFill([...($sujet ? ['subject' => self::TEXTE] : []), 'counterpart_muted_reason' => null])->save();
        }

        return $sujet || $motif;
    }
}
