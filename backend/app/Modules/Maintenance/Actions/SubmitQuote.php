<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Events\ApprovalRequested;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Support\Committed;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Notices;
use App\Modules\Maintenance\Support\Operators;
use App\Modules\Maintenance\Support\QuoteLookup;
use App\Modules\Maintenance\Support\Settings;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Money\Money;

final readonly class SubmitQuote
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private QuoteLookup $devis,
        private Committed $engage,
        private Operators $operateurs,
        private Notices $avis,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Fige le devis. Quand le cumul des devis acceptés et de celui-ci dépasse le plafond figé du mandat, une demande d'accord est
     * ouverte (échéance : réglage de l'organisation) ; le silence à l'échéance n'est jamais un accord.
     *
     * @return array{quote: InterventionQuote, approval: InterventionApproval|null}
     */
    public function handle(string $interventionId, string $quoteId): array
    {
        return DB::transaction(function () use ($interventionId, $quoteId): array {
            $intervention = $this->verrous->intervention($interventionId);
            $devis = $this->devis->quote($quoteId, $interventionId);

            if ($devis->status !== QuoteStatus::Received) {
                throw ErrorCode::QuoteStatusInvalid->problem();
            }

            if ($devis->valid_until !== null && $devis->valid_until->toDateString() < CarbonImmutable::today()->toDateString()) {
                throw ErrorCode::QuoteStatusInvalid->problem('Ce devis n\'est plus valable.');
            }

            $cumul = $this->engage->acceptedGross($intervention->id, $devis->id) + (int) $devis->total_gross->getAmount();
            $plafond = $intervention->ceiling_amount === null ? null : (int) $intervention->ceiling_amount->getAmount();
            $accord = ! $this->operateurs->isIndividualOrganization() && $cumul > $this->engage->emergencyCover($intervention) && ($plafond === null || $cumul > $plafond);

            $devis->forceFill(['status' => QuoteStatus::Submitted, 'lock_version' => $devis->lock_version + 1])->save();
            $this->chronologie->add($intervention, EventKind::QuoteSubmitted, ActorKind::Team, 'Devis soumis.', metadata: ['quote_id' => $devis->id]);
            $this->audit->handle('maintenance.quote.submitted', subject: $devis, metadata: ['intervention_id' => $intervention->id]);

            if (! $accord) {
                return ['quote' => $devis, 'approval' => null];
            }

            if ($this->devis->pendingFor($intervention->id) !== null) {
                throw ErrorCode::ApprovalAlreadyPending->problem();
            }

            if ($plafond === null) {
                throw ErrorCode::NoMandate->problem();
            }

            $echeance = now()->addHours(Settings::approvalDeadlineHours());
            $demande = InterventionApproval::query()->create([
                'intervention_id' => $intervention->id,
                'quote_id' => $devis->id,
                'amount' => new Money($cumul, $devis->total_gross->getCurrency()),
                'ceiling_amount' => new Money($plafond, $devis->total_gross->getCurrency()),
                'currency' => $intervention->currency,
                'status' => ApprovalStatus::Pending,
                'requested_at' => now(),
                'decide_before' => $echeance,
                'lock_version' => 1,
            ]);

            if ($intervention->status === InterventionStatus::Quoting) {
                $this->transitions->apply($intervention, InterventionStatus::AwaitingApproval);
            }

            $this->chronologie->add($intervention, EventKind::ApprovalRequested, ActorKind::Team, 'Accord du mandant demandé.', metadata: ['approval_id' => $demande->id]);
            $this->audit->handle('maintenance.approval.requested', subject: $demande, metadata: ['intervention_id' => $intervention->id, 'quote_id' => $devis->id]);
            $this->avis->approval($intervention, $cumul, $echeance->toDateString());
            ApprovalRequested::dispatch($intervention->id, $demande->id, $intervention->organization_id, $intervention->reference, $intervention->mandant_party_id);

            return ['quote' => $devis, 'approval' => $demande];
        });
    }
}
