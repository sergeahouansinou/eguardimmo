<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Maintenance\Enums\ApprovalBasis;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InvoiceAllocation;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Maintenance\Queries\PurgeCandidates;
use App\Modules\Maintenance\Support\Committed;
use App\Modules\Maintenance\Support\Currencies;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Throwable;

final readonly class VerifyMaintenance
{
    public function __construct(
        private CurrentOrganization $contexte,
        private PurgeCandidates $organisations,
        private LedgerReader $soldes,
        private Committed $engage,
    ) {}

    /**
     * Tâche quotidienne de contrôle : « Travaux à imputer » à zéro pour toute facture imputée, somme des parts égale au TTC, accord
     * pour tout engagement au-dessus du plafond, clôture sans facture non imputée. Elle signale, ne corrige rien.
     *
     * @return list<string>
     */
    public function handle(CarbonImmutable $today): array
    {
        $anomalies = [];

        foreach ($this->organisations->withInterventions() as $organisation) {
            try {
                array_push($anomalies, ...$this->contexte->run($organisation, fn (): array => $this->check($organisation)));
            } catch (Throwable $erreur) {
                report($erreur);
                $anomalies[] = "{$organisation} : contrôle impossible ({$erreur->getMessage()})";
            }
        }

        return $anomalies;
    }

    /**
     * @return list<string>
     */
    private function check(string $organisation): array
    {
        $anomalies = [];

        foreach (SupplierInvoice::query()->where('status', '<>', SupplierInvoiceStatus::Cancelled->value)->orderBy('id')->cursor() as $facture) {
            $parts = (int) InvoiceAllocation::query()->where('supplier_invoice_id', $facture->id)->whereNull('cancelled_at')->sum('share_amount');
            $brut = (int) $facture->total_gross->getAmount();

            if ($facture->status === SupplierInvoiceStatus::Allocated) {
                if ($parts !== $brut) {
                    $anomalies[] = "{$organisation} : facture {$facture->id} imputée, parts {$parts} pour un TTC de {$brut}";
                }

                if (! $this->soldes->worksPending($facture->id, Currencies::of($facture->currency))->isZero()) {
                    $anomalies[] = "{$organisation} : facture {$facture->id} imputée mais « Travaux à imputer » non nul";
                }
            } elseif ($parts > $brut) {
                $anomalies[] = "{$organisation} : facture {$facture->id}, parts {$parts} au-dessus du TTC {$brut}";
            }
        }

        foreach (Intervention::query()->whereNotNull('ceiling_amount')->whereNotIn('status', [InterventionStatus::Declined->value, InterventionStatus::Cancelled->value])->orderBy('id')->cursor() as $intervention) {
            $plafond = (int) $intervention->ceiling_amount?->getAmount();
            $cumul = $this->engage->acceptedGross($intervention->id);

            if ($cumul > $plafond && $intervention->approval_basis !== ApprovalBasis::SelfManaged && $cumul > $this->engage->emergencyCover($intervention)
                && ! InterventionApproval::query()->where('intervention_id', $intervention->id)->where('status', ApprovalStatus::Accepted->value)->where('amount', '>=', $cumul)->exists()) {
                $anomalies[] = "{$organisation} : intervention {$intervention->reference} engagée à {$cumul} au-dessus du plafond {$plafond} sans accord";
            }
        }

        foreach (Intervention::query()->where('status', InterventionStatus::Closed->value)->orderBy('id')->cursor() as $close) {
            if (SupplierInvoice::query()->where('intervention_id', $close->id)->where('status', SupplierInvoiceStatus::Recorded->value)->exists()) {
                $anomalies[] = "{$organisation} : intervention {$close->reference} clôturée avec une facture non imputée";
            }
        }

        return $anomalies;
    }
}
