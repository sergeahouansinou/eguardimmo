<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Enums\ApprovalBasis;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Models\SupplierInvoice;

final class Committed
{
    /**
     * TTC cumulé des devis acceptés de l'intervention (un avenant s'ajoute au premier), en unités mineures.
     */
    public function acceptedGross(string $interventionId, ?string $exceptQuoteId = null): int
    {
        return (int) InterventionQuote::query()
            ->where('intervention_id', $interventionId)
            ->where('status', QuoteStatus::Accepted->value)
            ->when($exceptQuoteId !== null, fn ($requete) => $requete->whereKeyNot($exceptQuoteId))
            ->sum('total_gross');
    }

    /**
     * Montant engagé : devis acceptés, à défaut l'estimation approuvée ; null quand rien ne borne l'engagement.
     */
    public function amount(Intervention $intervention): ?int
    {
        $devis = $this->acceptedGross($intervention->id);

        if ($devis > 0) {
            return $devis;
        }

        return $intervention->estimated_amount === null ? null : (int) $intervention->estimated_amount->getAmount();
    }

    /**
     * TTC cumulé des factures reçues non annulées de l'intervention ; avec `$jusquA`, seules comptent celles enregistrées avant
     * cette facture et elle-même (l'identifiant UUID v7 suit l'ordre d'enregistrement) : les premières consomment l'engagement.
     */
    public function invoicedGross(string $interventionId, ?string $jusquA = null): int
    {
        return (int) SupplierInvoice::query()
            ->where('intervention_id', $interventionId)
            ->where('status', '<>', SupplierInvoiceStatus::Cancelled->value)
            ->when($jusquA !== null, fn ($requete) => $requete->where('id', '<=', $jusquA))
            ->sum('total_gross');
    }

    /**
     * Montant que la dérogation d'urgence dispense d'accord : l'estimation de l'engagement, bornée par le plafond d'urgence
     * (ou ce plafond seul quand rien n'a été estimé). Au-delà, la règle normale s'applique, avenants compris.
     */
    public function emergencyCover(Intervention $intervention): int
    {
        if ($intervention->approval_basis !== ApprovalBasis::Emergency) {
            return 0;
        }

        $borne = Settings::emergencyCeilingMinor();

        return $intervention->estimated_amount === null ? $borne : min($borne, (int) $intervention->estimated_amount->getAmount());
    }
}
