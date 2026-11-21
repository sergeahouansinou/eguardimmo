<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Modules\Messaging\Enums\TicketStatus;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Support\SupportRules;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Éteint les accès arrivés à terme, ceux dont la demande de support est résolue et les demandes restées sans réponse. La garde ne s'appuie
 * jamais sur cette tâche : elle vérifie l'échéance et l'état de la demande à chaque lecture. Idempotent.
 */
final readonly class ExpireSupportAccess
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * @return int accès éteints
     */
    public function handle(?string $ticketId = null): int
    {
        $maintenant = now();
        $limiteDemande = $maintenant->copy()->subDays(SupportRules::ACCES_DEMANDE_JOURS)->format(PreciseTimestamp::FORMAT);
        $eteints = 0;

        SupportAccessGrant::query()
            ->whereIn('status', [SupportAccessStatus::Requested, SupportAccessStatus::Active])
            ->when($ticketId !== null, fn (Builder $q) => $q->where('support_ticket_id', $ticketId))
            ->where(fn (Builder $q) => $q
                ->where(fn (Builder $actif) => $actif->where('status', SupportAccessStatus::Active)->where('expires_at', '<=', $maintenant->format(PreciseTimestamp::FORMAT)))
                ->orWhere(fn (Builder $demande) => $demande->where('status', SupportAccessStatus::Requested)->where('requested_at', '<=', $limiteDemande))
                ->orWhereHas('ticket', fn (Builder $t) => $t->where('status', TicketStatus::Resolved)))
            ->orderBy('id')
            ->chunkById(100, function ($acces) use (&$eteints): void {
                foreach ($acces as $ligne) {
                    $eteints += DB::transaction(fn (): int => $this->eteindre($ligne->id));
                }
            });

        return $eteints;
    }

    private function eteindre(string $id): int
    {
        $acces = SupportAccessGrant::query()->whereKey($id)->lockForUpdate()->first();

        if ($acces === null || ! in_array($acces->status, [SupportAccessStatus::Requested, SupportAccessStatus::Active], true)) {
            return 0;
        }

        $acces->forceFill(['status' => SupportAccessStatus::Expired])->save();
        $this->audit->handle('messaging.support_access.expired', subject: $acces, metadata: ['grant_id' => $acces->id, 'read_count' => $acces->read_count]);

        return 1;
    }
}
