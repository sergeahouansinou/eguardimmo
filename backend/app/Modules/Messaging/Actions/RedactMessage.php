<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Data\TwoFactorProofData;
use App\Modules\Identity\Enums\ErrorCode as IdentityError;
use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Events\ConversationMessageRedacted;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Support\AttachmentPurger;
use App\Modules\Organizations\Enums\ErrorCode as OrganizationError;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Retrait d'un message (ADR 0033, décision 5) : par son auteur dans les 15 minutes, ensuite par `owner` ou `admin` de l'organisation
 * avec la 2FA et un motif. Le texte et les pièces disparaissent, la ligne reste. Suppose le contexte de l'organisation du fil.
 */
final readonly class RedactMessage
{
    public const int FENETRE_MINUTES = 15;

    public const string TEXTE = '[message retiré]';

    public function __construct(
        private AttachmentPurger $pieces,
        private RecordAudit $audit,
    ) {}

    public function handle(Conversation $fil, ConversationMessage $cible, User $acteur, MessageSide $cote, bool $administrateur, ?string $motif, ?TwoFactorProofData $preuve): ConversationMessage
    {
        return DB::transaction(function () use ($fil, $cible, $acteur, $cote, $administrateur, $motif, $preuve): ConversationMessage {
            $message = ConversationMessage::query()->whereKey($cible->id)->where('conversation_id', $fil->id)->lockForUpdate()->firstOrFail();

            if ($message->isRedacted()) {
                return $message;
            }

            $auteur = $message->author_user_id === $acteur->id;
            $dansLaFenetre = $message->sent_at->addMinutes(self::FENETRE_MINUTES)->isFuture();
            $parAuteur = $auteur && $dansLaFenetre;

            if (! $parAuteur) {
                $this->autoriserOrganisation($auteur, $cote, $administrateur, $acteur, $motif, $preuve);
            }

            $pieces = ConversationAttachment::query()->where('conversation_message_id', $message->id)->get();

            foreach ($pieces as $piece) {
                $this->pieces->purge($piece);
            }

            $message->forceFill([
                'body' => self::TEXTE,
                'redacted_at' => now(),
                'redacted_by_user_id' => $acteur->id,
                'redaction_reason' => $parAuteur ? null : $motif,
            ])->save();

            $this->audit->handle('messaging.message.redacted', subject: $message, metadata: [
                'conversation_id' => $fil->id,
                'kind' => $fil->kind->value,
                'by' => $parAuteur ? 'author' : 'organization',
                'attachments' => $pieces->count(),
            ]);

            if (! $parAuteur && $message->author_user_id !== $acteur->id) {
                ConversationMessageRedacted::dispatch($fil->organization_id, $fil->id, $message->id, $message->author_side->value, $message->author_user_id, $fil->party_id, $fil->lease_id);
            }

            return $message;
        });
    }

    private function autoriserOrganisation(bool $auteur, MessageSide $cote, bool $administrateur, User $acteur, ?string $motif, ?TwoFactorProofData $preuve): void
    {
        if ($cote !== MessageSide::Staff || ! $administrateur) {
            throw ($auteur ? ErrorCode::MessageRedactionExpired : ErrorCode::MessageRedactionForbidden)->problem();
        }

        if (! $acteur->hasConfirmedTwoFactor()) {
            throw OrganizationError::TwoFactorRequired->problem();
        }

        if ($preuve === null) {
            throw IdentityError::ReauthenticationRequired->problem();
        }

        if ($motif === null || trim($motif) === '') {
            throw ValidationException::withMessages(['reason' => 'Un motif est obligatoire pour retirer le message d\'un tiers.']);
        }
    }
}
