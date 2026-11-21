<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportTicket;
use App\Modules\Messaging\Support\SupportRules;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Une demande en attente du demandeur depuis 7 jours passe « résolue » (ADR 0033, décision 8) ; il peut la rouvrir 14 jours en répondant.
 * Le délai court depuis le passage à `waiting` (`waiting_since`), pas depuis le dernier message : un passage manuel à `waiting` ne se résout
 * pas la nuit même. Une réponse du demandeur remet la demande à `open` et efface `waiting_since`. Idempotent.
 */
final readonly class ResolveStaleTickets
{
    public function __construct(
        private RecordAudit $audit,
        private ExpireSupportAccess $acces,
    ) {}

    /**
     * @return int demandes résolues
     */
    public function handle(): int
    {
        $limite = now()->subDays(SupportRules::RESOLUTION_AUTO_JOURS)->format(PreciseTimestamp::FORMAT);
        $resolues = 0;

        SupportTicket::query()
            ->where('status', TicketStatus::Waiting)
            ->where('waiting_since', '<=', $limite)
            ->orderBy('id')
            ->chunkById(100, function ($demandes) use ($limite, &$resolues): void {
                foreach ($demandes as $demande) {
                    $resolues += DB::transaction(fn (): int => $this->resoudre($demande->id, $limite));
                }
            });

        return $resolues;
    }

    private function resoudre(string $id, string $limite): int
    {
        $ticket = SupportTicket::query()->whereKey($id)->lockForUpdate()->first();

        if ($ticket === null || $ticket->status !== TicketStatus::Waiting || $ticket->waiting_since === null || $ticket->waiting_since->format(PreciseTimestamp::FORMAT) > $limite) {
            return 0;
        }

        $ticket->moveTo(TicketStatus::Resolved);
        $ticket->forceFill(['resolved_at' => now()])->save();
        $this->acces->handle($ticket->id);
        $this->audit->handle('messaging.ticket.auto_resolved', subject: $ticket, metadata: ['reference' => $ticket->reference]);

        return 1;
    }
}
