<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\QuoteLookup;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use Illuminate\Support\Facades\DB;

final readonly class WithdrawApproval
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private QuoteLookup $devis,
        private Timeline $chronologie,
    ) {}

    /**
     * Retire la demande ouverte : un nouveau devis est nécessaire (l'ancien, vu par le mandant, reste figé et remplacé).
     */
    public function handle(string $interventionId, string $approvalId): InterventionApproval
    {
        return DB::transaction(function () use ($interventionId, $approvalId): InterventionApproval {
            $intervention = $this->verrous->intervention($interventionId);
            $demande = $this->devis->approval($approvalId, $interventionId);

            if (! $demande->status->isOpen()) {
                throw ErrorCode::ApprovalAlreadyDecided->problem();
            }

            $demande->forceFill(['status' => ApprovalStatus::Withdrawn, 'decided_at' => now(), 'lock_version' => $demande->lock_version + 1])->save();

            if ($demande->quote_id !== null) {
                $this->devis->quote($demande->quote_id, $intervention->id)->forceFill(['status' => QuoteStatus::Superseded])->save();
            }

            if ($intervention->status === InterventionStatus::AwaitingApproval) {
                $this->transitions->apply($intervention, InterventionStatus::Quoting);
            }

            $this->chronologie->add($intervention, EventKind::ApprovalWithdrawn, ActorKind::Team, 'Demande d\'accord retirée.', metadata: ['approval_id' => $demande->id], proprietaire: true);

            return $demande;
        });
    }
}
