<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Data\NewExternalConversationData;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\ConversationStatus;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Support\OperationLocks;
use App\Modules\Messaging\Support\StartedConversation;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Ouvre un fil avec une contrepartie ; suppose le contexte de l'organisation et un rattachement déjà vérifié par l'appelant
 * (fiche, bail ou mandat jamais crus du client, ADR 0033). Rejouable par `client_id`.
 */
final readonly class StartExternalConversation
{
    public const int FILS_OUVERTS_MAX = 10;

    public function __construct(
        private PostConversationMessage $poster,
        private RecordAudit $audit,
        private OperationLocks $verrous,
    ) {}

    public function handle(User $auteur, MessageSide $cote, NewExternalConversationData $donnees): StartedConversation
    {
        $existant = $this->rejeu($auteur, $donnees);

        if ($existant !== null) {
            return new StartedConversation($existant, true);
        }

        $fils = fn () => Conversation::query()->where('kind', $donnees->kind)->where('party_id', $donnees->partyId);

        if ($cote !== MessageSide::Staff && $fils()->where('counterpart_muted_until', '>', now())->exists()) {
            throw ErrorCode::ConversationMuted->problem();
        }

        $ouvrir = fn (): StartedConversation => $this->verrous->run('open:'.$donnees->partyId, fn (): StartedConversation => $this->ouvrir($auteur, $cote, $donnees, $fils));

        return $donnees->attachments !== [] && $cote !== MessageSide::Staff
            ? $this->verrous->run(PostConversationMessage::verrouPieces($auteur), $ouvrir)
            : $ouvrir();
    }

    /**
     * Le décompte des fils ouverts et l'insertion se font sous verrou applicatif par fiche : le verrou de ligne seul crée un interblocage
     * MySQL entre deux ouvertures simultanées. La clé unique (auteur, client_id) garde un seul fil si deux rejeux passent ensemble.
     *
     * @param  Closure(): Builder<Conversation>  $fils
     */
    private function ouvrir(User $auteur, MessageSide $cote, NewExternalConversationData $donnees, Closure $fils): StartedConversation
    {
        $existant = $this->rejeu($auteur, $donnees);

        if ($existant !== null) {
            return new StartedConversation($existant, true);
        }

        try {
            return DB::transaction(fn (): StartedConversation => $this->creer($auteur, $cote, $donnees, $fils), attempts: 3);
        } catch (UniqueConstraintViolationException $erreur) {
            $existant = $this->rejeu($auteur, $donnees) ?? throw $erreur;

            return new StartedConversation($existant, true);
        }
    }

    /**
     * @param  Closure(): Builder<Conversation>  $fils
     */
    private function creer(User $auteur, MessageSide $cote, NewExternalConversationData $donnees, Closure $fils): StartedConversation
    {
        if ($fils()->where('status', ConversationStatus::Open)->lockForUpdate()->count() >= self::FILS_OUVERTS_MAX) {
            throw ErrorCode::ConversationOpenLimit->problem();
        }

        $restriction = $cote === MessageSide::Staff ? $fils()->where('counterpart_muted_until', '>', now())->max('counterpart_muted_until') : null;
        $conversation = Conversation::query()->create([
            'subject' => $donnees->subject,
            'created_by_user_id' => $auteur->id,
            'client_id' => $donnees->clientId,
            'last_message_at' => now(),
            'last_author_user_id' => $auteur->id,
            'last_author_side' => $cote,
            'kind' => $donnees->kind,
            'party_id' => $donnees->partyId,
            'lease_id' => $donnees->kind === ConversationKind::Tenant ? $donnees->leaseId : null,
            'mandate_id' => $donnees->kind === ConversationKind::Owner ? $donnees->mandateId : null,
            'status' => ConversationStatus::Open,
            'counterpart_muted_until' => is_string($restriction) ? CarbonImmutable::parse($restriction) : null,
        ]);

        $this->poster->handle($conversation, $auteur, $cote, $donnees->body, $donnees->attachments, $donnees->clientId);
        $this->audit->handle('messaging.conversation.opened', subject: $conversation, metadata: ['kind' => $donnees->kind->value, 'opened_by' => $cote->value]);

        return new StartedConversation($conversation, false);
    }

    private function rejeu(User $auteur, NewExternalConversationData $donnees): ?Conversation
    {
        if ($donnees->clientId === null) {
            return null;
        }

        $message = ConversationMessage::query()->where('author_user_id', $auteur->id)->where('client_id', $donnees->clientId)->with('conversation')->first();

        if ($message === null) {
            return null;
        }

        $conversation = $message->conversation;

        if ($conversation->kind !== $donnees->kind || $conversation->party_id !== $donnees->partyId || $conversation->subject !== $donnees->subject || (! $message->isRedacted() && $message->body !== $donnees->body)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $conversation;
    }
}
