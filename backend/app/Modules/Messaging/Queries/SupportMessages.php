<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use App\Shared\Audit\PreciseTimestamp;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Messages d'une demande reçus après un message connu, pour l'interrogation périodique (ADR 0033, décision 3). Index
 * (support_ticket_id, sent_at). Le demandeur ne reçoit jamais une note interne.
 */
final class SupportMessages
{
    /**
     * @return array{messages: Collection<int, SupportTicketMessage>, has_more: bool}
     */
    public function after(SupportTicket $ticket, ?string $apres, int $parPage, bool $vueSupport): array
    {
        $requete = SupportTicketMessage::query()
            ->where('support_ticket_id', $ticket->id)
            ->when(! $vueSupport, fn (Builder $q) => $q->where('internal', false))
            ->with(['author', 'attachments'])
            ->orderBy('sent_at')
            ->orderBy('id');

        if ($apres !== null) {
            $repere = Str::isUuid($apres)
                ? SupportTicketMessage::query()->where('support_ticket_id', $ticket->id)->when(! $vueSupport, fn (Builder $q) => $q->where('internal', false))->whereKey($apres)->first()
                : null;

            if ($repere === null) {
                throw ErrorCode::MessageNotFound->problem();
            }

            $instant = $repere->sent_at->format(PreciseTimestamp::FORMAT);
            $requete->where(fn (Builder $q) => $q->where('sent_at', '>', $instant)->orWhere(fn (Builder $egal) => $egal->where('sent_at', $instant)->where('id', '>', $repere->id)));
        }

        $lignes = $requete->limit($parPage + 1)->get();

        return ['messages' => $lignes->take($parPage)->values(), 'has_more' => $lignes->count() > $parPage];
    }
}
