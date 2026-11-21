<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalBasis;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\QuoteKind;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Shared\Audit\RecordAudit;

/**
 * Passage d'un devis à `accepted` : un seul devis initial accepté par intervention (le précédent devient `superseded`), et
 * l'intervention est engagée si elle ne l'était pas encore.
 */
final readonly class QuoteAcceptance
{
    public function __construct(
        private Transitions $transitions,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    public function accept(Intervention $intervention, InterventionQuote $devis, ApprovalBasis $base, ActorKind $acteur): void
    {
        if ($devis->kind === QuoteKind::Initial) {
            InterventionQuote::query()->where('intervention_id', $intervention->id)->where('kind', QuoteKind::Initial->value)
                ->where('status', QuoteStatus::Accepted->value)->whereKeyNot($devis->id)
                ->get()->each(fn (InterventionQuote $ancien) => $ancien->forceFill(['status' => QuoteStatus::Superseded, 'lock_version' => $ancien->lock_version + 1])->save());
        }

        $devis->forceFill(['status' => QuoteStatus::Accepted, 'lock_version' => $devis->lock_version + 1])->save();

        if (in_array($intervention->status, [InterventionStatus::Qualified, InterventionStatus::Quoting, InterventionStatus::AwaitingApproval], true)) {
            $this->transitions->apply($intervention, InterventionStatus::Approved, ['approval_basis' => $intervention->approval_basis === ApprovalBasis::Emergency ? ApprovalBasis::Emergency : $base]);
            $this->chronologie->add($intervention, EventKind::Approved, $acteur, 'Travaux engagés.');
            $this->audit->handle('maintenance.intervention.approved', subject: $intervention, metadata: ['reference' => $intervention->reference, 'basis' => $base->value]);
        }

        $this->chronologie->add($intervention, EventKind::QuoteAccepted, $acteur, 'Devis accepté.', metadata: ['quote_id' => $devis->id]);
        $this->audit->handle('maintenance.quote.accepted', subject: $devis, metadata: ['intervention_id' => $intervention->id]);
    }
}
