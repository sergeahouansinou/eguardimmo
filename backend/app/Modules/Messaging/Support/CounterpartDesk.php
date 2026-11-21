<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\PostConversationMessage;
use App\Modules\Messaging\Actions\RedactMessage;
use App\Modules\Messaging\Actions\SetConversationState;
use App\Modules\Messaging\Data\ThreadFilters;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Http\Resources\Counterpart\CounterpartMessageResource;
use App\Modules\Messaging\Http\Resources\Counterpart\CounterpartThreadResource;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Modules\Messaging\Queries\ThreadMessages;
use App\Modules\Messaging\Queries\ThreadScopes;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\Cursor;

/**
 * Ce que les espaces locataire et propriétaire font d'un fil déjà autorisé par leur clé : lister, lire, interroger, écrire, marquer lu.
 * La clé d'accès reste évaluée par l'appelant, jamais ici.
 */
final readonly class CounterpartDesk
{
    public function __construct(
        private ThreadLookupsBuilder $lookups,
        private ThreadMessages $messages,
        private PostConversationMessage $poster,
        private SetConversationState $etat,
        private RedactMessage $retrait,
        private CurrentOrganization $organisation,
    ) {}

    /**
     * @param  Builder<Conversation>  $requete  fils visibles du compte, avec l'état de lecture
     * @param  Closure(Conversation): bool  $peutRepondre
     */
    public function list(Builder $requete, User $user, ThreadFilters $filtres, Closure $peutRepondre): AnonymousResourceCollection
    {
        $requete = ThreadScopes::archived($requete, $user->id, $filtres->archived);

        if ($filtres->unreadOnly) {
            $requete = ThreadScopes::unread($requete, $user->id);
        }

        if ($filtres->since !== null) {
            $requete->where('conversations.last_message_at', '>', $filtres->since->format('Y-m-d H:i:s.u'));
        }

        if ($filtres->leaseId !== null) {
            $requete->where('conversations.lease_id', $filtres->leaseId);
        }

        if ($filtres->search !== null) {
            $requete->where('conversations.subject', 'like', '%'.addcslashes($filtres->search, '%_\\').'%');
        }

        $page = $requete
            ->orderByDesc('conversations.last_message_at')
            ->orderByDesc('conversations.id')
            ->cursorPaginate($filtres->perPage, cursor: $filtres->cursor === null ? null : Cursor::fromEncoded($filtres->cursor));
        $fils = array_values($page->items());
        $lookups = $this->lookups->for($fils);

        return CounterpartThreadResource::collection(array_map(
            fn (Conversation $f): array => ['conversation' => $f, 'lookups' => $lookups, 'viewer' => $user->id, 'can_reply' => $peutRepondre($f)],
            $fils,
        ))->additional(['meta' => ['has_more' => $page->hasMorePages(), 'next_cursor' => $page->nextCursor()?->encode()]]);
    }

    public function show(Conversation $fil, User $user, bool $peutRepondre, ?int $parPage = null): JsonResource
    {
        $lookups = $this->lookups->for([$fil]);
        $page = $this->messages->page($fil, null, null, $parPage ?? 50);

        return new JsonResource([
            ...(new CounterpartThreadResource(['conversation' => $fil, 'lookups' => $lookups, 'viewer' => $user->id, 'can_reply' => $peutRepondre]))->resolve(),
            'messages' => $page['messages']->map(fn (ConversationMessage $m): array => (new CounterpartMessageResource(['message' => $m, 'viewer' => $user->id]))->resolve())->all(),
            'messages_meta' => ['has_more' => $page['has_more'], 'next_cursor' => $page['next_cursor']],
        ]);
    }

    public function messages(Conversation $fil, User $user, ?string $apres, ?string $curseur, int $parPage, bool $peutRepondre): JsonResource
    {
        $page = $this->messages->page($fil, $apres, $curseur, $parPage);

        return CounterpartMessageResource::collection($page['messages']->map(fn (ConversationMessage $m): array => ['message' => $m, 'viewer' => $user->id])->all())
            ->additional(['meta' => [
                'has_more' => $page['has_more'],
                'next_cursor' => $page['next_cursor'],
                'status' => $fil->status->value,
                'agency_last_read_at' => CounterpartThreadResource::iso($fil->getAttribute('other_last_read_at')),
                'can_reply' => $peutRepondre && $fil->status->value === 'open' && $fil->counterpart_muted_until?->isFuture() !== true,
            ]]);
    }

    /**
     * @param  list<UploadedFile>  $pieces
     */
    public function post(Conversation $fil, User $user, MessageSide $cote, string $corps, array $pieces, string $clientId): PostedMessage
    {
        return $this->organisation->run($fil->organization_id, function () use ($fil, $user, $cote, $corps, $pieces, $clientId): PostedMessage {
            $envoye = $this->poster->handle($fil, $user, $cote, $corps, $pieces, $clientId);
            $envoye->message->load(['author', 'attachments']);

            return $envoye;
        });
    }

    /**
     * Retrait par l'auteur seulement, dans la fenêtre de 15 minutes : la contrepartie n'a pas d'autre voie.
     */
    public function redact(Conversation $fil, string $messageId, User $user, MessageSide $cote): ConversationMessage
    {
        return $this->organisation->run($fil->organization_id, function () use ($fil, $messageId, $user, $cote): ConversationMessage {
            $message = ConversationMessage::query()->where('conversation_id', $fil->id)->whereKey($messageId)->first() ?? throw ErrorCode::MessageNotFound->problem();
            $this->retrait->handle($fil, $message, $user, $cote, false, null, null);

            return $message->refresh()->load(['author', 'attachments']);
        });
    }

    public function mark(Conversation $fil, User $user, MessageSide $cote, ?bool $lu, ?bool $archive): void
    {
        $this->organisation->run($fil->organization_id, function () use ($fil, $user, $cote, $lu, $archive): void {
            $this->etat->handle(Participations::of($fil, $user->id, $cote), $lu, $archive);
        });
    }
}
