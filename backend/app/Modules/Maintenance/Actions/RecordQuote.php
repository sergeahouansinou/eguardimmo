<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Data\QuoteInputData;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\QuoteKind;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\QuoteWriter;
use App\Modules\Maintenance\Support\Timeline;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RecordQuote
{
    public function __construct(
        private Locks $verrous,
        private QuoteWriter $redacteur,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Devis saisi d'après le PDF du prestataire : le serveur recalcule net, taxe et TTC. Le devis initial se saisit pendant la
     * demande de devis, un avenant une fois les travaux engagés.
     */
    public function handle(string $interventionId, QuoteInputData $donnees): InterventionQuote
    {
        return DB::transaction(function () use ($interventionId, $donnees): InterventionQuote {
            $intervention = $this->verrous->intervention($interventionId);

            if ($intervention->supplier_party_id === null) {
                throw ErrorCode::SupplierRequired->problem();
            }

            $permis = $donnees->kind === QuoteKind::Initial
                ? [InterventionStatus::Quoting]
                : [InterventionStatus::Approved, InterventionStatus::Scheduled, InterventionStatus::InProgress, InterventionStatus::Completed, InterventionStatus::Invoiced];

            if (! in_array($intervention->status, $permis, true)) {
                throw ErrorCode::TransitionInvalid->problem();
            }

            $ecriture = $this->redacteur->fill($intervention, $donnees, null);
            $devis = InterventionQuote::query()->create([
                ...$ecriture['fields'],
                'intervention_id' => $intervention->id,
                'supplier_party_id' => $intervention->supplier_party_id,
                'status' => QuoteStatus::Received,
                'created_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
                'lock_version' => 1,
            ]);
            $this->redacteur->writeLines($devis, $ecriture['lines']);

            $this->chronologie->add($intervention, EventKind::QuoteRecorded, ActorKind::Team, 'Devis reçu.', metadata: ['quote_id' => $devis->id]);
            $this->audit->handle('maintenance.quote.recorded', subject: $devis, metadata: ['intervention_id' => $intervention->id, 'kind' => $devis->kind->value]);

            return $devis;
        });
    }
}
