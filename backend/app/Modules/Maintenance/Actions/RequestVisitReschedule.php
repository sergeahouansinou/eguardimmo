<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\VisitSlot;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Modules\Maintenance\Events\VisitRescheduleRequested;
use App\Modules\Maintenance\Models\InterventionVisit;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\VisitFlow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class RequestVisitReschedule
{
    public function __construct(
        private Locks $verrous,
        private VisitFlow $visites,
        private Timeline $chronologie,
    ) {}

    /**
     * Le locataire demande un autre créneau, il ne déplace rien : le prestataire n'est pas joignable par l'application.
     */
    public function handle(string $interventionId, string $visitId, string $requestedOn, VisitSlot $slot): InterventionVisit
    {
        return DB::transaction(function () use ($interventionId, $visitId, $requestedOn, $slot): InterventionVisit {
            $intervention = $this->verrous->intervention($interventionId);
            $visite = $this->visites->lock($visitId, $interventionId);
            $aujourdhui = CarbonImmutable::today();

            if (! in_array($intervention->status, [InterventionStatus::Approved, InterventionStatus::Scheduled, InterventionStatus::InProgress], true)) {
                throw ErrorCode::VisitStatusInvalid->problem();
            }

            if (! in_array($visite->status, [VisitStatus::Proposed, VisitStatus::Confirmed, VisitStatus::RescheduleRequested], true)) {
                throw ErrorCode::VisitStatusInvalid->problem();
            }

            if ($requestedOn <= $aujourdhui->toDateString() || $requestedOn > $aujourdhui->addDays(90)->toDateString()) {
                throw ErrorCode::VisitStatusInvalid->problem('La date demandée doit être dans les 90 prochains jours.');
            }

            $visite->forceFill(['status' => VisitStatus::RescheduleRequested, 'requested_on' => $requestedOn, 'requested_slot' => $slot, 'lock_version' => $visite->lock_version + 1])->save();
            $this->chronologie->add($intervention, EventKind::VisitRescheduleRequested, ActorKind::Tenant, 'Un autre créneau a été demandé.', metadata: ['visit_id' => $visite->id], locataire: true);
            VisitRescheduleRequested::dispatch($intervention->id, $visite->id, $visite->lock_version, $intervention->organization_id, $intervention->lease_id, $intervention->reference);

            return $visite;
        });
    }
}
