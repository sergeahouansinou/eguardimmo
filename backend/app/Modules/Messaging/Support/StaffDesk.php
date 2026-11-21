<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\TwoFactorProofs;
use App\Modules\Messaging\Actions\PostConversationMessage;
use App\Modules\Messaging\Actions\RedactMessage;
use App\Modules\Messaging\Actions\RestrictCounterpart;
use App\Modules\Messaging\Actions\SetConversationState;
use App\Modules\Messaging\Actions\StartExternalConversation;
use App\Modules\Messaging\Actions\UpdateExternalConversation;
use App\Modules\Messaging\Data\NewExternalConversationData;
use App\Modules\Messaging\Data\ThreadFilters;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\ConversationStatus;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\InboxTab;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Resources\Organization\ExternalMessageResource;
use App\Modules\Messaging\Http\Resources\Organization\ExternalThreadResource;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Queries\StaffThreads;
use App\Modules\Messaging\Queries\ThreadMessages;
use App\Modules\Messaging\Queries\ThreadScopes;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\Cursor;

/**
 * Les fils avec une contrepartie, vus de l'équipe de l'organisation courante. Le rôle et le type de fil sont évalués par l'appelant
 * avec `StaffAccess` ; ici, tout se lit et s'écrit dans le contexte de l'organisation posé par la route.
 */
final readonly class StaffDesk
{
    public function __construct(
        private StaffThreads $fils,
        private ThreadLookupsBuilder $lookups,
        private ThreadMessages $messages,
        private PostConversationMessage $poster,
        private SetConversationState $etat,
        private UpdateExternalConversation $miseAJour,
        private RedactMessage $retrait,
        private RestrictCounterpart $restriction,
        private StartExternalConversation $demarrer,
        private ExternalRecipients $destinataires,
        private TwoFactorProofs $preuves,
        private StaffAccess $acces,
    ) {}

    public function list(User $user, ConversationKind $kind, ThreadFilters $filtres): AnonymousResourceCollection
    {
        $requete = ThreadScopes::tab($this->fils->list($user->id, $kind), $filtres->tab ?? InboxTab::All, $user->id);

        if ($filtres->since !== null) {
            $requete->where('conversations.last_message_at', '>', $filtres->since->format('Y-m-d H:i:s.u'));
        }

        if ($filtres->leaseId !== null) {
            $requete->where('conversations.lease_id', $filtres->leaseId);
        }

        $page = $this->fils->recherche($requete, $filtres->search)
            ->orderByDesc('conversations.last_message_at')
            ->orderByDesc('conversations.id')
            ->cursorPaginate($filtres->perPage, cursor: $filtres->cursor === null ? null : Cursor::fromEncoded($filtres->cursor));
        $fils = array_values($page->items());
        $lookups = $this->lookups->for($fils, true);

        return ExternalThreadResource::collection(array_map(
            fn (Conversation $f): array => ['conversation' => $f, 'lookups' => $lookups, 'viewer' => $user->id],
            $fils,
        ))->additional(['meta' => [
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
            'counts' => $this->fils->counts($user->id, $kind, $filtres->search),
        ]]);
    }

    public function show(Conversation $fil, User $user, ?int $parPage = null): JsonResource
    {
        $page = $this->messages->page($fil, null, null, $parPage ?? 50);

        return new JsonResource([
            ...$this->resume($fil, $user),
            'messages' => $page['messages']->map(fn (ConversationMessage $m): array => (new ExternalMessageResource(['message' => $m, 'viewer' => $user->id]))->resolve())->all(),
            'messages_meta' => ['has_more' => $page['has_more'], 'next_cursor' => $page['next_cursor']],
        ]);
    }

    public function messages(Conversation $fil, User $user, ?string $apres, ?string $curseur, int $parPage): AnonymousResourceCollection
    {
        $page = $this->messages->page($fil, $apres, $curseur, $parPage);

        return ExternalMessageResource::collection($page['messages']->map(fn (ConversationMessage $m): array => ['message' => $m, 'viewer' => $user->id])->all())
            ->additional(['meta' => [
                'has_more' => $page['has_more'],
                'next_cursor' => $page['next_cursor'],
                'status' => $fil->status->value,
                'counterpart_last_read_at' => $this->resume($fil, $user)['counterpart_last_read_at'],
            ]]);
    }

    /**
     * @param  list<UploadedFile>  $pieces
     */
    public function post(Conversation $fil, User $user, string $corps, array $pieces, ?string $clientId): PostedMessage
    {
        $envoye = $this->poster->handle($fil, $user, MessageSide::Staff, $corps, $pieces, $clientId);
        $envoye->message->load(['author', 'attachments']);

        return $envoye;
    }

    public function messageResource(ConversationMessage $message, User $user): ExternalMessageResource
    {
        return new ExternalMessageResource(['message' => $message, 'viewer' => $user->id]);
    }

    public function open(User $user, NewExternalConversationData $donnees): StartedConversation
    {
        $this->destinataires->assertReachable($donnees->kind, $donnees->partyId, $donnees->leaseId, $donnees->mandateId);

        return $this->demarrer->handle($user, MessageSide::Staff, $donnees);
    }

    public function fresh(User $user, string $conversationId): Conversation
    {
        return $this->fils->find($user->id, $conversationId) ?? throw ErrorCode::ConversationNotFound->problem();
    }

    public function mark(Conversation $fil, User $user, ?bool $lu, ?bool $archive): void
    {
        $this->etat->handle(Participations::of($fil, $user->id, MessageSide::Staff), $lu, $archive);
    }

    public function update(Conversation $fil, User $user, ?ConversationStatus $statut, bool $assigner, ?string $assigneId): void
    {
        $this->miseAJour->handle($fil, $user, $statut, $assigner, $assigneId);
    }

    public function redact(Request $request, Conversation $fil, string $messageId, User $user, ?string $motif): ConversationMessage
    {
        $adhesion = $this->acces->assertExternal($user, $fil->kind);
        $message = ConversationMessage::query()->where('conversation_id', $fil->id)->whereKey($messageId)->first() ?? throw ErrorCode::MessageNotFound->problem();
        $this->retrait->handle($fil, $message, $user, MessageSide::Staff, $this->acces->canAdminister($adhesion), $motif, $this->preuves->recent($request));

        return $message->refresh()->load(['author', 'attachments']);
    }

    public function restrict(Conversation $fil, ?int $jours, ?string $motif): void
    {
        $this->restriction->handle($fil, $jours, $motif);
    }

    /**
     * @return array<string, mixed>
     */
    public function resume(Conversation $fil, User $user): array
    {
        return (new ExternalThreadResource(['conversation' => $fil, 'lookups' => $this->lookups->for([$fil], true), 'viewer' => $user->id]))->resolve();
    }
}
