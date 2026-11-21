<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Messaging\Models\ConversationMessage;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Messages d'un fil, dans le contexte de son organisation : les plus récents par curseur (remontée de l'historique), ou ceux
 * reçus après un message connu pour l'interrogation périodique (ADR 0033, décision 3). Index (conversation_id, sent_at).
 */
final readonly class ThreadMessages
{
    public function __construct(private CurrentOrganization $organisation) {}

    /**
     * @return array{messages: Collection<int, ConversationMessage>, has_more: bool, next_cursor: ?string}
     */
    public function page(Conversation $fil, ?string $apres, ?string $curseur, int $parPage): array
    {
        return $this->organisation->run($fil->organization_id, fn (): array => $apres !== null ? $this->apres($fil, $apres, $parPage) : $this->recents($fil, $curseur, $parPage));
    }

    /**
     * @return array{messages: Collection<int, ConversationMessage>, has_more: bool, next_cursor: ?string}
     */
    private function apres(Conversation $fil, string $apres, int $parPage): array
    {
        $repere = Str::isUuid($apres) ? $this->base($fil)->whereKey($apres)->first() : null;

        if ($repere === null) {
            throw ErrorCode::MessageNotFound->problem();
        }

        $instant = $repere->sent_at->format(PreciseTimestamp::FORMAT);
        $lignes = $this->base($fil)
            ->where(fn (Builder $q) => $q->where('sent_at', '>', $instant)->orWhere(fn (Builder $egal) => $egal->where('sent_at', $instant)->where('id', '>', $repere->id)))
            ->orderBy('sent_at')
            ->orderBy('id')
            ->limit($parPage + 1)
            ->get();

        return ['messages' => $lignes->take($parPage)->values(), 'has_more' => $lignes->count() > $parPage, 'next_cursor' => null];
    }

    /**
     * @return array{messages: Collection<int, ConversationMessage>, has_more: bool, next_cursor: ?string}
     */
    private function recents(Conversation $fil, ?string $curseur, int $parPage): array
    {
        $page = $this->base($fil)
            ->orderByDesc('sent_at')
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));

        return [
            'messages' => collect($page->items())->reverse()->values(),
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ];
    }

    /**
     * @return Builder<ConversationMessage>
     */
    private function base(Conversation $fil): Builder
    {
        return ConversationMessage::query()->where('conversation_id', $fil->id)->with(['author', 'attachments']);
    }
}
