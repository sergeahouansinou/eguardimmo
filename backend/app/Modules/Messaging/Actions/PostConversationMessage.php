<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\ConversationStatus;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Events\ConversationMessagePosted;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Models\ConversationParticipant;
use App\Modules\Messaging\Support\OperationLocks;
use App\Modules\Messaging\Support\Participations;
use App\Modules\Messaging\Support\PostedMessage;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Suppose le contexte de l'organisation du fil. Rejouable : un `client_id` déjà reçu rend le message existant sans rien écrire.
 */
final readonly class PostConversationMessage
{
    public const int CONSERVATION_ANNEES = 5;

    public const int PIECES_PAR_JOUR = 30;

    public const int OCTETS_PAR_FIL = 200 * 1024 * 1024;

    public function __construct(
        private DocumentStore $documents,
        private RecordAudit $audit,
        private OperationLocks $verrous,
    ) {}

    public static function verrouPieces(User $auteur): string
    {
        return 'pieces:'.$auteur->id;
    }

    /**
     * @param  list<UploadedFile>  $attachments
     */
    public function handle(Conversation $conversation, User $auteur, MessageSide $cote, string $body, array $attachments, ?string $clientId = null): PostedMessage
    {
        $existant = $this->rejeu($conversation, $auteur, $body, $clientId);

        if ($existant !== null) {
            return new PostedMessage($existant, true);
        }

        $enregistrer = fn (): PostedMessage => DB::transaction(fn (): PostedMessage => $this->poster($conversation, $auteur, $cote, $body, $attachments, $clientId));

        try {
            return $attachments !== [] && $cote !== MessageSide::Staff
                ? $this->verrous->run(self::verrouPieces($auteur), $enregistrer)
                : $enregistrer();
        } catch (UniqueConstraintViolationException $erreur) {
            $existant = $this->rejeu($conversation, $auteur, $body, $clientId) ?? throw $erreur;

            return new PostedMessage($existant, true);
        }
    }

    /**
     * @param  list<UploadedFile>  $attachments
     */
    private function poster(Conversation $fil, User $auteur, MessageSide $cote, string $body, array $attachments, ?string $clientId): PostedMessage
    {
        $conversation = Conversation::query()->whereKey($fil->id)->lockForUpdate()->firstOrFail();
        $this->verifier($conversation, $auteur, $cote, $attachments);

        $maintenant = now();
        $conservation = $maintenant->copy()->addYears(self::CONSERVATION_ANNEES);
        $message = $conversation->messages()->create([
            'author_user_id' => $auteur->id,
            'author_side' => $cote,
            'client_id' => $clientId,
            'body' => $body,
            'sent_at' => $maintenant,
        ]);

        foreach ($attachments as $fichier) {
            $stocke = $this->documents->store(FileSource::path((string) $fichier->getRealPath()), $fichier->getClientOriginalName(), FileCategory::Supporting, new DocumentSubject($message->getMorphClass(), $message->id), $conservation);
            $message->attachments()->create([
                'stored_file_id' => $stocke->id,
                'original_name' => $stocke->displayName,
                'mime_type' => $stocke->mimeType,
                'size_bytes' => $stocke->sizeBytes,
            ]);
        }

        $rouvert = $conversation->status === ConversationStatus::Closed && $cote === MessageSide::Staff;
        $conversation->forceFill([
            'last_message_at' => $maintenant,
            'last_author_user_id' => $auteur->id,
            'last_author_side' => $cote,
            'retention_until' => $conservation,
            ...($rouvert ? ['status' => ConversationStatus::Open, 'closed_at' => null, 'closed_by_user_id' => null] : []),
        ])->save();

        ConversationParticipant::query()->where('conversation_id', $conversation->id)->update(['archived_at' => null]);
        Participations::of($conversation, $auteur->id, $cote)->forceFill(['last_read_at' => $maintenant])->save();

        if ($rouvert) {
            $this->audit->handle('messaging.conversation.reopened', subject: $conversation, metadata: ['kind' => $conversation->kind->value]);
        }

        $this->annoncer($conversation, $message, $auteur, $cote);

        return new PostedMessage($message, false);
    }

    private function rejeu(Conversation $conversation, User $auteur, string $body, ?string $clientId): ?ConversationMessage
    {
        if ($clientId === null) {
            return null;
        }

        $message = ConversationMessage::query()
            ->where('conversation_id', $conversation->id)
            ->where('author_user_id', $auteur->id)
            ->where('client_id', $clientId)
            ->first();

        if ($message !== null && ! $message->isRedacted() && $message->body !== $body) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $message;
    }

    /**
     * @param  list<UploadedFile>  $attachments
     */
    private function verifier(Conversation $conversation, User $auteur, MessageSide $cote, array $attachments): void
    {
        if ($cote !== MessageSide::Staff) {
            if ($conversation->status === ConversationStatus::Closed) {
                throw ErrorCode::ConversationClosed->problem();
            }

            if ($conversation->counterpart_muted_until?->isFuture() === true) {
                throw ErrorCode::ConversationMuted->problem();
            }
        }

        if ($attachments === []) {
            return;
        }

        $envoyees = ConversationAttachment::query()
            ->whereIn('conversation_message_id', ConversationMessage::query()->where('author_user_id', $auteur->id)->where('sent_at', '>', now()->subDay())->select('id'))
            ->count();

        if ($cote !== MessageSide::Staff && $envoyees + count($attachments) > self::PIECES_PAR_JOUR) {
            throw ErrorCode::ConversationAttachmentLimit->problem();
        }

        $octets = (int) ConversationAttachment::query()
            ->whereIn('conversation_message_id', ConversationMessage::query()->where('conversation_id', $conversation->id)->select('id'))
            ->sum('size_bytes');
        $ajoutes = array_sum(array_map(fn (UploadedFile $fichier): int => (int) $fichier->getSize(), $attachments));

        if ($octets + $ajoutes > self::OCTETS_PAR_FIL) {
            throw ErrorCode::ConversationStorageFull->problem();
        }
    }

    private function annoncer(Conversation $conversation, ConversationMessage $message, User $auteur, MessageSide $cote): void
    {
        if ($conversation->kind === ConversationKind::Internal || $conversation->party_id === null) {
            return;
        }

        $marques = ConversationParticipant::query()->where('conversation_id', $conversation->id)->get()
            ->mapWithKeys(fn (ConversationParticipant $p): array => [$p->user_id => $p->last_read_at?->format('Y-m-d H:i:s.u') ?? 'never'])
            ->all();

        ConversationMessagePosted::dispatch(
            $conversation->organization_id,
            $conversation->id,
            $message->id,
            $conversation->kind->value,
            $cote->value,
            $auteur->id,
            $conversation->party_id,
            $conversation->lease_id,
            $conversation->assignee_user_id,
            $marques,
        );
    }
}
