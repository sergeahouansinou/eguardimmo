<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\QuoteLookup;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RefuseQuote
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private QuoteLookup $devis,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    public function handle(string $interventionId, string $quoteId): InterventionQuote
    {
        return DB::transaction(function () use ($interventionId, $quoteId): InterventionQuote {
            $intervention = $this->verrous->intervention($interventionId);
            $devis = $this->devis->quote($quoteId, $interventionId);

            if (! in_array($devis->status, [QuoteStatus::Received, QuoteStatus::Submitted], true)) {
                throw ErrorCode::QuoteStatusInvalid->problem();
            }

            $devis->forceFill(['status' => QuoteStatus::Refused, 'lock_version' => $devis->lock_version + 1])->save();

            InterventionApproval::query()->where('quote_id', $devis->id)->whereIn('status', [ApprovalStatus::Pending->value, ApprovalStatus::Question->value])
                ->get()->each(fn (InterventionApproval $demande) => $demande->forceFill(['status' => ApprovalStatus::Withdrawn, 'decided_at' => now(), 'lock_version' => $demande->lock_version + 1])->save());

            if ($intervention->status === InterventionStatus::AwaitingApproval) {
                $this->transitions->apply($intervention, InterventionStatus::Quoting);
            }

            $this->chronologie->add($intervention, EventKind::QuoteRefused, ActorKind::Team, 'Devis refusé.', metadata: ['quote_id' => $devis->id]);
            $this->audit->handle('maintenance.quote.refused', subject: $devis, metadata: ['intervention_id' => $intervention->id]);

            return $devis;
        });
    }
}
