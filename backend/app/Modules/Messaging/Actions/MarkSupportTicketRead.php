<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Messaging\Models\SupportTicket;
use Illuminate\Support\Facades\DB;

/**
 * Accusé de lecture, rejouable : l'horodatage ne bouge que s'il existe un message de l'autre côté posté depuis la dernière lecture.
 * Les notes internes ne comptent jamais pour le demandeur.
 */
final class MarkSupportTicketRead
{
    public function handle(SupportTicket $ticket, bool $parLeSupport): void
    {
        DB::transaction(function () use ($ticket, $parLeSupport): void {
            $dernier = $ticket->messages()->getQuery()->reorder()
                ->where('internal', false)
                ->where('from_support', ! $parLeSupport)
                ->max('sent_at');
            $colonne = $parLeSupport ? 'support_last_read_at' : 'requester_last_read_at';
            $lu = $ticket->{$colonne};

            if ($dernier === null || ($lu !== null && $lu->format('Y-m-d H:i:s.u') >= (string) $dernier)) {
                return;
            }

            $ticket->{$colonne} = now();
            $ticket->save();
        });
    }
}
