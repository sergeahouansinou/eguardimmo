<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Models\SupportTicket;
use App\Shared\Privacy\ExportSection;

/**
 * Demandes d'assistance d'un compte pour un export de données personnelles : jamais les notes internes de l'équipe ni le chemin d'une pièce.
 */
final readonly class SupportTicketExport
{
    public function forAccount(string $userId): ExportSection
    {
        $demandes = SupportTicket::query()
            ->where('requester_user_id', $userId)
            ->with(['messages' => fn ($q) => $q->where('internal', false)->with('attachments')])
            ->orderBy('created_at')
            ->get();

        $tickets = [];

        foreach ($demandes as $t) {
            $messages = [];

            foreach ($t->messages as $m) {
                $pieces = [];

                foreach ($m->attachments as $a) {
                    $pieces[] = ['name' => $a->original_name, 'mime_type' => $a->mime_type, 'size_bytes' => $a->size_bytes];
                }

                $messages[] = ['from_support' => $m->from_support, 'body' => $m->body, 'sent_at' => $m->sent_at->toIso8601String(), 'attachments' => $pieces];
            }

            $tickets[] = [
                'reference' => $t->reference,
                'category' => $t->category->value,
                'subject' => $t->subject,
                'status' => $t->status->value,
                'created_at' => $t->created_at->toIso8601String(),
                'messages' => $messages,
            ];
        }

        return new ExportSection('support_tickets', ['tickets' => $tickets]);
    }
}
