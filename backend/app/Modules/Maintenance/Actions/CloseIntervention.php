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
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CloseIntervention
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Clôture quand toutes les factures non annulées sont imputées ; sans facture, un motif est obligatoire.
     */
    public function handle(string $interventionId, int $lockVersion, ?string $noInvoiceReason): Intervention
    {
        return DB::transaction(function () use ($interventionId, $lockVersion, $noInvoiceReason): Intervention {
            $intervention = $this->verrous->intervention($interventionId);
            $this->verrous->expectVersion($intervention, $lockVersion);
            $this->transitions->assertIn($intervention, InterventionStatus::Completed, InterventionStatus::Invoiced);

            $factures = SupplierInvoice::query()->where('intervention_id', $intervention->id)->where('status', '<>', SupplierInvoiceStatus::Cancelled->value)->lockForUpdate()->get();

            if ($factures->isEmpty() && ($noInvoiceReason === null || trim($noInvoiceReason) === '')) {
                throw ErrorCode::CloseBlocked->problem('Aucune facture reçue : un motif est obligatoire.');
            }

            if ($factures->contains(fn (SupplierInvoice $facture): bool => $facture->status !== SupplierInvoiceStatus::Allocated)) {
                throw ErrorCode::CloseBlocked->problem('Une facture reçue reste à imputer.');
            }

            $this->transitions->apply($intervention, InterventionStatus::Closed, ['closed_at' => now()]);
            $this->chronologie->add($intervention, EventKind::Closed, ActorKind::Team, $factures->isEmpty() ? 'Clôturée sans facture : '.$noInvoiceReason : 'Intervention clôturée.');
            $this->audit->handle('maintenance.intervention.closed', subject: $intervention, metadata: ['reference' => $intervention->reference]);

            return $intervention;
        });
    }
}
