<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportAttachment;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Models\SupportTicketMessage;
use App\Modules\Messaging\Support\AttachmentStore;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Purge des demandes de support (ADR 0033, décision 12) : pièces 1 an après `resolved_at`, textes 3 ans après. Les lignes, références,
 * dates, auteurs et objets restent ; une demande rouverte (`resolved_at` effacé) n'est jamais purgée. Rejouable.
 */
final readonly class PurgeSupportTickets
{
    public const int PIECES_ANNEES = 1;

    public const int TEXTES_ANNEES = 3;

    public function __construct(private RecordAudit $audit) {}

    /**
     * @return array{attachments: int, tickets: int}
     */
    public function handle(): array
    {
        $bilan = ['attachments' => 0, 'tickets' => 0];

        $this->resolues(self::PIECES_ANNEES)
            ->whereHas('messages.attachments')
            ->chunkById(100, function ($demandes) use (&$bilan): void {
                foreach ($demandes as $demande) {
                    $bilan['attachments'] += DB::transaction(fn (): int => $this->purgerPieces($demande->id));
                }
            });

        $this->resolues(self::TEXTES_ANNEES)
            ->whereNull('content_purged_at')
            ->chunkById(100, function ($demandes) use (&$bilan): void {
                foreach ($demandes as $demande) {
                    $bilan['tickets'] += DB::transaction(fn (): int => $this->purgerTextes($demande->id));
                }
            });

        return $bilan;
    }

    /**
     * @return Builder<SupportTicket>
     */
    private function resolues(int $annees): Builder
    {
        return SupportTicket::query()
            ->where('status', TicketStatus::Resolved)
            ->whereNotNull('resolved_at')
            ->where('resolved_at', '<', now()->subYears($annees)->format('Y-m-d H:i:s.u'));
    }

    private function purgerPieces(string $demandeId): int
    {
        $demande = $this->verrouiller($demandeId, self::PIECES_ANNEES);

        if ($demande === null) {
            return 0;
        }

        $pieces = SupportAttachment::query()->whereIn('support_ticket_message_id', SupportTicketMessage::query()->where('support_ticket_id', $demande->id)->select('id'))->get();

        if ($pieces->isEmpty()) {
            return 0;
        }

        foreach ($pieces as $piece) {
            Storage::disk(AttachmentStore::DISQUE)->delete($piece->path);
            $piece->delete();
        }

        $this->audit->handle('messaging.ticket.attachments_purged', subject: $demande, metadata: ['attachments' => $pieces->count()]);

        return $pieces->count();
    }

    private function purgerTextes(string $demandeId): int
    {
        $demande = $this->verrouiller($demandeId, self::TEXTES_ANNEES);

        if ($demande === null || $demande->content_purged_at !== null) {
            return 0;
        }

        $effaces = SupportTicketMessage::query()
            ->where('support_ticket_id', $demande->id)
            ->where('body', '!=', ErasePartyMessages::TEXTE)
            ->update(['body' => ErasePartyMessages::TEXTE]);

        $demande->forceFill(['content_purged_at' => now()])->save();
        $this->audit->handle('messaging.ticket.content_purged', subject: $demande, metadata: ['messages' => $effaces]);

        return 1;
    }

    private function verrouiller(string $id, int $annees): ?SupportTicket
    {
        $demande = SupportTicket::query()->whereKey($id)->lockForUpdate()->first();

        if ($demande === null || $demande->status !== TicketStatus::Resolved || $demande->resolved_at === null || $demande->resolved_at->gt(now()->subYears($annees))) {
            return null;
        }

        return $demande;
    }
}
