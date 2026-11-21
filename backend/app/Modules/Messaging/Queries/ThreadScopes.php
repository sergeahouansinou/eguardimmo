<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Enums\InboxTab;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

/**
 * Lecture des fils d'un compte : état de lecture propre au compte et accusé de l'autre camp, sans requête par ligne.
 */
final class ThreadScopes
{
    /**
     * @param  Builder<Conversation>  $requete
     * @param  list<MessageSide>  $autresCotes  camps dont la lecture donne l'accusé
     * @return Builder<Conversation>
     */
    public static function withReadState(Builder $requete, string $compte, array $autresCotes): Builder
    {
        $participant = fn (): QueryBuilder => DB::table('conversation_participants')->whereColumn('conversation_participants.conversation_id', 'conversations.id');

        return $requete
            ->select('conversations.*')
            ->selectSub($participant()->where('user_id', $compte)->select('last_read_at'), 'my_last_read_at')
            ->selectSub($participant()->where('user_id', $compte)->select('archived_at'), 'my_archived_at')
            ->selectSub($participant()->whereIn('side', array_map(fn (MessageSide $c): string => $c->value, $autresCotes))->selectRaw('max(last_read_at)'), 'other_last_read_at')
            ->selectSub(DB::table('conversation_messages')->selectRaw('count(*)')->whereColumn('conversation_messages.conversation_id', 'conversations.id'), 'messages_count')
            ->selectSub(self::dernier()->select('body'), 'preview_body')
            ->selectSub(DB::table('conversation_attachments')->selectRaw('count(*)')->where('conversation_message_id', '=', self::dernier()->select('id')), 'preview_attachments')
            ->selectSub(DB::table('users')->select('name')->whereColumn('users.id', 'conversations.last_author_user_id'), 'last_author_name');
    }

    private static function dernier(): QueryBuilder
    {
        return DB::table('conversation_messages')
            ->whereColumn('conversation_messages.conversation_id', 'conversations.id')
            ->orderByDesc('conversation_messages.sent_at')
            ->orderByDesc('conversation_messages.id')
            ->limit(1);
    }

    /**
     * @param  Builder<Conversation>  $requete
     * @return Builder<Conversation>
     */
    public static function unread(Builder $requete, string $compte): Builder
    {
        return $requete
            ->where('conversations.last_author_user_id', '!=', $compte)
            ->whereNotExists(fn (QueryBuilder $p) => $p->from('conversation_participants')
                ->selectRaw('1')
                ->whereColumn('conversation_participants.conversation_id', 'conversations.id')
                ->where('conversation_participants.user_id', $compte)
                ->whereColumn('conversation_participants.last_read_at', '>=', 'conversations.last_message_at'));
    }

    /**
     * @param  Builder<Conversation>  $requete
     * @return Builder<Conversation>
     */
    public static function archived(Builder $requete, string $compte, bool $archive): Builder
    {
        $existe = fn (QueryBuilder $p) => $p->from('conversation_participants')
            ->selectRaw('1')
            ->whereColumn('conversation_participants.conversation_id', 'conversations.id')
            ->where('conversation_participants.user_id', $compte)
            ->whereNotNull('conversation_participants.archived_at');

        return $archive ? $requete->whereExists($existe) : $requete->whereNotExists($existe);
    }

    /**
     * Onglets de la boîte de l'équipe, comme ceux des fils internes ; « en attente » : la contrepartie a écrit en dernier.
     *
     * @param  Builder<Conversation>  $requete
     * @return Builder<Conversation>
     */
    public static function tab(Builder $requete, InboxTab $onglet, string $compte): Builder
    {
        return match ($onglet) {
            InboxTab::All => self::archived($requete, $compte, false),
            InboxTab::Archived => self::archived($requete, $compte, true),
            InboxTab::Sent => self::archived($requete, $compte, false)->where('conversations.last_author_side', MessageSide::Staff->value),
            InboxTab::Awaiting => self::archived($requete, $compte, false)->where('conversations.last_author_side', '!=', MessageSide::Staff->value),
            InboxTab::Unread => self::unread(self::archived($requete, $compte, false), $compte),
        };
    }
}
