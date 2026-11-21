<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\DeclineReason;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Events\InterventionDeclined;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class DeclineIntervention
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    public function handle(string $interventionId, int $lockVersion, DeclineReason $motif, string $note): Intervention
    {
        return DB::transaction(function () use ($interventionId, $lockVersion, $motif, $note): Intervention {
            $intervention = $this->verrous->intervention($interventionId);
            $this->verrous->expectVersion($intervention, $lockVersion);
            $this->transitions->assertIn($intervention, InterventionStatus::Reported, InterventionStatus::Qualified);
            $this->transitions->apply($intervention, InterventionStatus::Declined, ['decline_reason' => $motif->value, 'decline_note' => $note]);

            $this->chronologie->add($intervention, EventKind::Declined, ActorKind::Team, $note, locataire: true);
            $this->audit->handle('maintenance.intervention.declined', subject: $intervention, metadata: ['reference' => $intervention->reference, 'reason' => $motif->value]);
            InterventionDeclined::dispatch($intervention->id, $intervention->organization_id, $intervention->lease_id, $intervention->reference);

            return $intervention;
        });
    }
}
