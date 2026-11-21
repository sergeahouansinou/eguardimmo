<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Modules\Maintenance\Events\VisitScheduled;
use App\Modules\Maintenance\Models\InterventionVisit;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Modules\Maintenance\Support\VisitFlow;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ConfirmVisit
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private VisitFlow $visites,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Le locataire confirme le créneau proposé ; l'équipe confirme aussi celui que le locataire a demandé (elle seule peut le faire).
     */
    public function handle(string $interventionId, string $visitId, ActorKind $acteur): InterventionVisit
    {
        return DB::transaction(function () use ($interventionId, $visitId, $acteur): InterventionVisit {
            $intervention = $this->verrous->intervention($interventionId);
            $visite = $this->visites->lock($visitId, $interventionId);

            $permis = $acteur === ActorKind::Tenant ? [VisitStatus::Proposed] : [VisitStatus::Proposed, VisitStatus::RescheduleRequested];

            if (! in_array($visite->status, $permis, true) || ! in_array($intervention->status, [InterventionStatus::Approved, InterventionStatus::Scheduled, InterventionStatus::InProgress], true)) {
                throw ErrorCode::VisitStatusInvalid->problem();
            }

            $demande = $visite->status === VisitStatus::RescheduleRequested;
            $visite->forceFill([
                'scheduled_on' => $demande ? $visite->requested_on : $visite->scheduled_on,
                'slot' => $demande ? $visite->requested_slot : $visite->slot,
                'status' => VisitStatus::Confirmed,
                'requested_on' => null,
                'requested_slot' => null,
                'lock_version' => $visite->lock_version + 1,
            ])->save();

            if ($intervention->status === InterventionStatus::Approved) {
                $this->transitions->apply($intervention, InterventionStatus::Scheduled);
            }

            $this->chronologie->add($intervention, EventKind::VisitConfirmed, $acteur, 'Rendez-vous confirmé.', metadata: ['visit_id' => $visite->id], locataire: true);
            $this->audit->handle('maintenance.intervention.scheduled', subject: $intervention, metadata: ['reference' => $intervention->reference, 'visit_id' => $visite->id, 'by' => $acteur->value]);

            if ($demande) {
                VisitScheduled::dispatch($intervention->id, $visite->id, $visite->lock_version, $intervention->organization_id, $intervention->lease_id, $intervention->reference, $visite->scheduled_on->toDateString());
            }

            return $visite;
        });
    }
}
