<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionOrigin;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionVisit;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CancelIntervention
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Le locataire n'annule que la demande qu'il a signalée, tant qu'elle n'est pas qualifiée ; l'équipe annule jusqu'à la fin des travaux.
     */
    public function handle(string $interventionId, ActorKind $acteur, ?int $lockVersion = null, ?string $reporterPartyId = null): Intervention
    {
        return DB::transaction(function () use ($interventionId, $acteur, $lockVersion, $reporterPartyId): Intervention {
            $intervention = $this->verrous->intervention($interventionId);
            $this->verrous->expectVersion($intervention, $lockVersion);

            if ($acteur === ActorKind::Tenant) {
                if ($intervention->origin !== InterventionOrigin::Tenant || $intervention->status !== InterventionStatus::Reported
                    || $intervention->reporter_party_id === null || $intervention->reporter_party_id !== $reporterPartyId) {
                    throw ErrorCode::TransitionInvalid->problem();
                }
            }

            $this->transitions->apply($intervention, InterventionStatus::Cancelled);

            InterventionApproval::query()->where('intervention_id', $intervention->id)->whereIn('status', [ApprovalStatus::Pending->value, ApprovalStatus::Question->value])
                ->get()->each(fn (InterventionApproval $demande) => $demande->forceFill(['status' => ApprovalStatus::Withdrawn, 'decided_at' => now()])->save());
            InterventionVisit::query()->where('intervention_id', $intervention->id)->whereIn('status', [VisitStatus::Proposed->value, VisitStatus::Confirmed->value, VisitStatus::RescheduleRequested->value])
                ->get()->each(fn (InterventionVisit $visite) => $visite->forceFill(['status' => VisitStatus::Cancelled, 'lock_version' => $visite->lock_version + 1])->save());

            $this->chronologie->add($intervention, EventKind::Cancelled, $acteur, 'Demande annulée.', locataire: true);
            $this->audit->handle('maintenance.intervention.cancelled', subject: $intervention, metadata: ['reference' => $intervention->reference, 'by' => $acteur->value]);

            return $intervention;
        });
    }
}
