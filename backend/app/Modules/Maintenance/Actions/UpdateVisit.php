<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Data\VisitData;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Modules\Maintenance\Events\VisitScheduled;
use App\Modules\Maintenance\Models\InterventionVisit;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Modules\Maintenance\Support\VisitFlow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class UpdateVisit
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private VisitFlow $visites,
        private Timeline $chronologie,
    ) {}

    /**
     * Contre-proposition ou changement de créneau : la visite revient à `proposed` et doit être reconfirmée.
     */
    public function handle(string $interventionId, string $visitId, VisitData $donnees): InterventionVisit
    {
        return DB::transaction(function () use ($interventionId, $visitId, $donnees): InterventionVisit {
            $intervention = $this->verrous->intervention($interventionId);
            $visite = $this->visites->lock($visitId, $interventionId);

            if (! in_array($visite->status, [VisitStatus::Proposed, VisitStatus::Confirmed, VisitStatus::RescheduleRequested], true)) {
                throw ErrorCode::VisitStatusInvalid->problem();
            }

            if ($donnees->scheduledOn < CarbonImmutable::today()->toDateString()) {
                throw ErrorCode::VisitStatusInvalid->problem('La date doit être aujourd\'hui ou plus tard.');
            }

            $visite->forceFill([
                'scheduled_on' => $donnees->scheduledOn,
                'slot' => $donnees->slot,
                'presence_required' => $donnees->presenceRequired,
                'contact_name' => $donnees->contactName,
                'contact_phone' => $donnees->contactPhone,
                'status' => VisitStatus::Proposed,
                'requested_on' => null,
                'requested_slot' => null,
                'lock_version' => $visite->lock_version + 1,
            ])->save();

            $this->visites->fallBack($intervention, $this->transitions);
            $this->chronologie->add($intervention, EventKind::VisitProposed, ActorKind::Team, 'Rendez-vous modifié.', metadata: ['visit_id' => $visite->id], locataire: true);
            VisitScheduled::dispatch($intervention->id, $visite->id, $visite->lock_version, $intervention->organization_id, $intervention->lease_id, $intervention->reference, $donnees->scheduledOn);

            return $visite;
        });
    }
}
