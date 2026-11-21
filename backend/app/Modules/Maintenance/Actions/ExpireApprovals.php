<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Events\ApprovalExpired;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Queries\DueApprovals;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Throwable;

final readonly class ExpireApprovals
{
    public function __construct(
        private CurrentOrganization $contexte,
        private DueApprovals $echues,
        private Locks $verrous,
        private Transitions $transitions,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Tâche horaire : le silence n'est jamais un accord. Chaque demande échue passe `expired` une seule fois (l'événement n'est émis
     * qu'à ce passage), le devis aussi, et l'intervention repasse en demande de devis. Une organisation en échec n'arrête pas les autres.
     *
     * @return array{expired: int, failures: list<string>}
     */
    public function handle(CarbonImmutable $maintenant): array
    {
        $bilan = ['expired' => 0, 'failures' => []];

        foreach ($this->echues->organizations($maintenant) as $organisation) {
            try {
                $bilan['expired'] += (int) $this->contexte->run($organisation, fn (): int => $this->expire($maintenant));
            } catch (Throwable $erreur) {
                report($erreur);
                $bilan['failures'][] = "{$organisation} : {$erreur->getMessage()}";
            }
        }

        return $bilan;
    }

    private function expire(CarbonImmutable $maintenant): int
    {
        $total = 0;

        foreach ($this->echues->ids($maintenant) as $id) {
            $total += DB::transaction(function () use ($id, $maintenant): int {
                $demande = InterventionApproval::query()->whereKey($id)->lockForUpdate()->first();

                if ($demande === null || ! $demande->status->isOpen() || $demande->decide_before->greaterThan($maintenant)) {
                    return 0;
                }

                $this->expireLocked($demande, $this->verrous->intervention($demande->intervention_id), $maintenant);

                return 1;
            });
        }

        return $total;
    }

    /**
     * L'intervention est déjà verrouillée par l'appelant, la demande aussi.
     */
    public function expireLocked(InterventionApproval $demande, Intervention $intervention, CarbonImmutable $maintenant): void
    {
        $demande->forceFill(['status' => ApprovalStatus::Expired, 'decided_at' => $maintenant, 'lock_version' => $demande->lock_version + 1])->save();

        if ($demande->quote_id !== null) {
            InterventionQuote::query()->whereKey($demande->quote_id)->first()?->forceFill(['status' => QuoteStatus::Expired])->save();
        }

        if ($intervention->status === InterventionStatus::AwaitingApproval) {
            $this->transitions->apply($intervention, InterventionStatus::Quoting);
        }

        $this->chronologie->add($intervention, EventKind::ApprovalExpired, ActorKind::System, 'Demande d\'accord expirée sans réponse.', metadata: ['approval_id' => $demande->id], proprietaire: true);
        $this->audit->handle('maintenance.approval.expired', subject: $demande, metadata: ['intervention_id' => $intervention->id]);
        ApprovalExpired::dispatch($intervention->id, $demande->id, $intervention->organization_id, $intervention->reference, $intervention->mandant_party_id);
    }
}
