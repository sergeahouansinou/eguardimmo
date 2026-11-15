<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Data\ConversationFilters;
use App\Modules\Messaging\Enums\InboxTab;
use App\Modules\Messaging\Models\ConversationParticipant;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

final class Inbox
{
    public const DELAI_RELANCE_HEURES = 48;

    /**
     * @return LengthAwarePaginator<int, ConversationParticipant>
     */
    public function list(string $userId, ConversationFilters $filtres): LengthAwarePaginator
    {
        return $this->onglet($this->base($userId, $filtres->search), $filtres->tab, $userId)
            ->with(['conversation.participants.user', 'conversation.latestMessage.attachments'])
            ->selectSub(DB::table('conversation_messages')->selectRaw('count(*)')->whereColumn('conversation_messages.conversation_id', 'conversation_participants.conversation_id'), 'messages_count')
            ->orderByDesc('conversations.last_message_at')
            ->orderByDesc('conversations.id')
            ->paginate($filtres->perPage, page: $filtres->page);
    }

    /**
     * @return array<string, int>
     */
    public function counts(string $userId, ?string $recherche): array
    {
        $compter = fn (InboxTab $onglet): int => $this->onglet($this->base($userId, $recherche), $onglet, $userId)->count();

        return array_combine(
            array_map(fn (InboxTab $onglet): string => $onglet->value, InboxTab::cases()),
            array_map($compter, InboxTab::cases()),
        );
    }

    /**
     * @return array{unread: int, stale: int}
     */
    public function stats(string $userId): array
    {
        return [
            'unread' => $this->onglet($this->base($userId, null), InboxTab::Unread, $userId)->count(),
            'stale' => $this->onglet($this->base($userId, null), InboxTab::Awaiting, $userId)
                ->where('conversations.last_message_at', '<', now()->subHours(self::DELAI_RELANCE_HEURES))
                ->count(),
        ];
    }

    /**
     * @return Builder<ConversationParticipant>
     */
    private function base(string $userId, ?string $recherche): Builder
    {
        $requete = ConversationParticipant::query()
            ->select('conversation_participants.*')
            ->join('conversations', 'conversations.id', '=', 'conversation_participants.conversation_id')
            ->where('conversation_participants.user_id', $userId);

        if ($recherche !== null) {
            $motif = '%'.addcslashes($recherche, '%_\\').'%';
            $requete->where(function (Builder $q) use ($motif, $userId): void {
                $q->where('conversations.subject', 'like', $motif)
                    ->orWhereExists(fn ($s) => $s->from('conversation_participants as autres')
                        ->join('users', 'users.id', '=', 'autres.user_id')
                        ->whereColumn('autres.conversation_id', 'conversations.id')
                        ->where('autres.user_id', '!=', $userId)
                        ->where('users.name', 'like', $motif));
            });
        }

        return $requete;
    }

    /**
     * @param  Builder<ConversationParticipant>  $requete
     * @return Builder<ConversationParticipant>
     */
    private function onglet(Builder $requete, InboxTab $onglet, string $userId): Builder
    {
        return match ($onglet) {
            InboxTab::All => $requete->whereNull('conversation_participants.archived_at'),
            InboxTab::Archived => $requete->whereNotNull('conversation_participants.archived_at'),
            InboxTab::Sent => $requete->whereNull('conversation_participants.archived_at')->where('conversations.last_author_user_id', $userId),
            InboxTab::Awaiting => $requete->whereNull('conversation_participants.archived_at')->where('conversations.last_author_user_id', '!=', $userId),
            InboxTab::Unread => $requete->whereNull('conversation_participants.archived_at')
                ->where('conversations.last_author_user_id', '!=', $userId)
                ->where(fn (Builder $q) => $q->whereNull('conversation_participants.last_read_at')
                    ->orWhereColumn('conversation_participants.last_read_at', '<', 'conversations.last_message_at')),
        };
    }
}
