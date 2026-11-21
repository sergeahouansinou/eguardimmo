<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalBasis;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;

/**
 * Suites d'une décision du mandant sur le devis et l'intervention, communes à la décision saisie par l'agence et à celle du
 * mandant lui-même ; appelée sous le verrou de l'intervention.
 */
final readonly class ApprovalEffects
{
    public function __construct(
        private Transitions $transitions,
        private QuoteLookup $devis,
        private QuoteAcceptance $acceptation,
    ) {}

    public function apply(Intervention $intervention, InterventionApproval $demande, ApprovalStatus $cible): void
    {
        $devis = $demande->quote_id === null ? null : $this->devis->quote($demande->quote_id, $intervention->id);

        if ($cible === ApprovalStatus::Accepted && $devis !== null) {
            $this->acceptation->accept($intervention, $devis, ApprovalBasis::OwnerApproved, ActorKind::Owner);
        }

        if ($cible === ApprovalStatus::Refused) {
            $devis?->forceFill(['status' => QuoteStatus::Refused, 'lock_version' => $devis->lock_version + 1])->save();

            if ($intervention->status === InterventionStatus::AwaitingApproval) {
                $this->transitions->apply($intervention, InterventionStatus::Quoting);
            }
        }
    }
}
