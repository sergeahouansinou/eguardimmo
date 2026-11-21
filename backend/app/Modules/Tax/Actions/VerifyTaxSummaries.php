<?php

declare(strict_types=1);

namespace App\Modules\Tax\Actions;

use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Enums\SummaryStatus;
use App\Modules\Tax\Models\TaxSummary;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Contrôle quotidien : une synthèse figée a sa pièce et son PDF, et un recalcul sur le grand livre d'aujourd'hui redonne la même empreinte. Il signale, ne corrige rien : un écart se traite par un rectificatif.
 */
final readonly class VerifyTaxSummaries
{
    public const string INCOMPLET = 'tax_summary_incomplete';

    public const string ECART = 'tax_summary_differs_from_ledger';

    public const string NON_VERIFIABLE = 'tax_summary_not_verifiable';

    public function __construct(
        private CurrentOrganization $contexte,
        private ComputeRentalIncome $calculBailleur,
        private ComputeMandantStatement $calculMandant,
        private RecordAudit $audit,
    ) {}

    /**
     * @return list<array{organization: string, summary: string, kind: string}>
     */
    public function handle(): array
    {
        $anomalies = [];
        $organisations = DB::table('tax_summaries')->whereIn('status', [SummaryStatus::Final->value, SummaryStatus::Published->value])->distinct()->orderBy('organization_id')->pluck('organization_id');

        foreach ($organisations as $organisation) {
            $this->contexte->run((string) $organisation, function () use ($organisation, &$anomalies): void {
                TaxSummary::query()->whereIn('status', [SummaryStatus::Final->value, SummaryStatus::Published->value])->chunkById(100, function ($syntheses) use ($organisation, &$anomalies): void {
                    foreach ($syntheses as $synthese) {
                        $genre = $this->constat($synthese);

                        if ($genre === null) {
                            continue;
                        }

                        $anomalies[] = ['organization' => (string) $organisation, 'summary' => $synthese->id, 'kind' => $genre];
                        Log::critical('Anomalie d\'une synthèse fiscale figée', ['organization_id' => (string) $organisation, 'summary_id' => $synthese->id, 'kind' => $genre]);
                        $this->audit->handle('tax.verify.anomaly', subject: $synthese, metadata: ['kind' => $genre]);
                    }
                });
            });
        }

        return $anomalies;
    }

    private function constat(TaxSummary $synthese): ?string
    {
        if ($synthese->stored_file_id === null || $synthese->issued_document_id === null) {
            return self::INCOMPLET;
        }

        try {
            $recalcule = $synthese->scope === SummaryScope::Mandant
                ? $this->calculMandant->handle((string) $synthese->mandant_party_id, $synthese->income_year)
                : $this->calculBailleur->handle($synthese->income_year, ($synthese->snapshot['household_complete'] ?? false) === true);
        } catch (ApiProblem) {
            return self::NON_VERIFIABLE;
        }

        return hash_equals($synthese->fingerprint, $recalcule->income->fingerprint()) ? null : self::ECART;
    }
}
