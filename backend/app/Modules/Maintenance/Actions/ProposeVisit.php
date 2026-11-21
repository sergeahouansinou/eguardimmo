<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Data\VisitData;
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
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ProposeVisit
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private Timeline $chronologie,
    ) {}

    public function handle(string $interventionId, VisitData $donnees): InterventionVisit
    {
        return DB::transaction(function () use ($interventionId, $donnees): InterventionVisit {
            $intervention = $this->verrous->intervention($interventionId);
            $this->transitions->assertIn($intervention, InterventionStatus::Approved, InterventionStatus::Scheduled, InterventionStatus::InProgress);

            if ($donnees->scheduledOn < CarbonImmutable::today()->toDateString()) {
                throw ErrorCode::VisitStatusInvalid->problem('La date doit être aujourd\'hui ou plus tard.');
            }

            $visite = InterventionVisit::query()->create([
                'intervention_id' => $intervention->id,
                'supplier_party_id' => $intervention->supplier_party_id,
                'scheduled_on' => $donnees->scheduledOn,
                'slot' => $donnees->slot,
                'presence_required' => $donnees->presenceRequired,
                'status' => VisitStatus::Proposed,
                'contact_name' => $donnees->contactName,
                'contact_phone' => $donnees->contactPhone,
                'lock_version' => 1,
            ]);

            $this->chronologie->add($intervention, EventKind::VisitProposed, ActorKind::Team, 'Rendez-vous proposé.', metadata: ['visit_id' => $visite->id], locataire: true);
            VisitScheduled::dispatch($intervention->id, $visite->id, $visite->lock_version, $intervention->organization_id, $intervention->lease_id, $intervention->reference, $donnees->scheduledOn);

            return $visite;
        });
    }
}
