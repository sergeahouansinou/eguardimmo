<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use Illuminate\Support\Facades\DB;

final readonly class ReopenIntervention
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private Timeline $chronologie,
    ) {}

    public function handle(string $interventionId, int $lockVersion): Intervention
    {
        return DB::transaction(function () use ($interventionId, $lockVersion): Intervention {
            $intervention = $this->verrous->intervention($interventionId);
            $this->verrous->expectVersion($intervention, $lockVersion);
            $this->transitions->assertIn($intervention, InterventionStatus::Completed);

            if (SupplierInvoice::query()->where('intervention_id', $intervention->id)->where('status', '<>', SupplierInvoiceStatus::Cancelled->value)->exists()) {
                throw ErrorCode::ReopenBlocked->problem();
            }

            $this->transitions->apply($intervention, InterventionStatus::InProgress, ['completed_on' => null, 'completion_note' => null]);
            $this->chronologie->add($intervention, EventKind::Reopened, ActorKind::Team, 'Intervention rouverte.');

            return $intervention;
        });
    }
}
