<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalBasis;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Support\Committed;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Operators;
use App\Modules\Maintenance\Support\QuoteAcceptance;
use App\Modules\Maintenance\Support\QuoteLookup;
use Illuminate\Support\Facades\DB;

final readonly class AcceptQuote
{
    public function __construct(
        private Locks $verrous,
        private QuoteLookup $devis,
        private Committed $engage,
        private Operators $operateurs,
        private QuoteAcceptance $acceptation,
    ) {}

    /**
     * L'équipe accepte seule quand le cumul reste sous le plafond (ou pour un bailleur autonome) ; au-dessus, l'accord du mandant
     * déjà enregistré pour ce devis est exigé.
     */
    public function handle(string $interventionId, string $quoteId): InterventionQuote
    {
        return DB::transaction(function () use ($interventionId, $quoteId): InterventionQuote {
            $intervention = $this->verrous->intervention($interventionId);
            $devis = $this->devis->quote($quoteId, $interventionId);

            if (! in_array($devis->status, [QuoteStatus::Received, QuoteStatus::Submitted], true)) {
                throw ErrorCode::QuoteStatusInvalid->problem();
            }

            if ($this->devis->pendingFor($intervention->id) !== null) {
                throw ErrorCode::ApprovalRequired->problem();
            }

            $cumul = $this->engage->acceptedGross($intervention->id, $devis->id) + (int) $devis->total_gross->getAmount();
            $plafond = $intervention->ceiling_amount === null ? null : (int) $intervention->ceiling_amount->getAmount();
            $base = ApprovalBasis::UnderCeiling;

            if ($this->operateurs->isIndividualOrganization()) {
                $base = ApprovalBasis::SelfManaged;
            } elseif ($cumul > $this->engage->emergencyCover($intervention) && ($plafond === null || $cumul > $plafond)) {
                $accord = InterventionApproval::query()->where('intervention_id', $intervention->id)->where('quote_id', $devis->id)
                    ->where('status', ApprovalStatus::Accepted->value)->where('amount', '>=', $cumul)->exists();

                if (! $accord) {
                    throw ErrorCode::ApprovalRequired->problem();
                }

                $base = ApprovalBasis::OwnerApproved;
            }

            $this->acceptation->accept($intervention, $devis, $base, ActorKind::Team);

            return $devis;
        });
    }
}
