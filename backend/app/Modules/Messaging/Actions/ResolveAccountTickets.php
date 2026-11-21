<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportTicket;
use Illuminate\Support\Facades\DB;

/**
 * Compte supprimé : ses demandes ouvertes passent « résolues », le contenu suit la conservation (ADR 0033, décision 8). Idempotent.
 */
final readonly class ResolveAccountTickets
{
    public function __construct(private ExpireSupportAccess $acces) {}

    public function handle(string $userId): int
    {
        $resolues = 0;

        SupportTicket::query()
            ->where('requester_user_id', $userId)
            ->where('status', '!=', TicketStatus::Resolved)
            ->orderBy('id')
            ->chunkById(100, function ($demandes) use (&$resolues): void {
                foreach ($demandes as $demande) {
                    DB::transaction(function () use ($demande, &$resolues): void {
                        $demande->moveTo(TicketStatus::Resolved);
                        $demande->forceFill(['resolved_at' => now()])->save();
                        $this->acces->handle($demande->id);
                        $resolues++;
                    });
                }
            });

        return $resolues;
    }
}
