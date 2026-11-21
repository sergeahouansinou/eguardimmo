<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Events\InterventionCompleted;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class CompleteIntervention
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    public function handle(string $interventionId, int $lockVersion, string $completedOn, string $note): Intervention
    {
        return DB::transaction(function () use ($interventionId, $lockVersion, $completedOn, $note): Intervention {
            $intervention = $this->verrous->intervention($interventionId);
            $this->verrous->expectVersion($intervention, $lockVersion);
            $this->transitions->assertIn($intervention, InterventionStatus::InProgress);

            if ($completedOn > CarbonImmutable::today()->toDateString() || $completedOn < $intervention->reported_on->toDateString()) {
                throw ErrorCode::TransitionInvalid->problem('La date de fin doit se situer entre le signalement et aujourd\'hui.');
            }

            $this->transitions->apply($intervention, InterventionStatus::Completed, ['completed_on' => $completedOn, 'completion_note' => $note]);
            $this->chronologie->add($intervention, EventKind::Completed, ActorKind::Team, 'Intervention terminée.', locataire: true);
            $this->audit->handle('maintenance.intervention.completed', subject: $intervention, metadata: ['reference' => $intervention->reference]);
            InterventionCompleted::dispatch($intervention->id, $intervention->organization_id, $intervention->lease_id, $intervention->reference);

            return $intervention;
        });
    }
}
