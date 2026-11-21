<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\ReportComputer;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;

/**
 * Contrôle quotidien : un compte rendu publié a son numéro, sa pièce et des chiffres identiques au grand livre. Il signale, ne
 * corrige rien (une correction passe par un rectificatif).
 */
final readonly class VerifyReports
{
    public const string INCOMPLET = 'published_report_incomplete';

    public const string ECART = 'published_report_differs_from_ledger';

    private const int JOURS = 400;

    public function __construct(
        private CurrentOrganization $contexte,
        private LedgerAggregates $grandLivre,
        private ReportComputer $calcul,
        private RecordAudit $audit,
    ) {}

    /**
     * @return list<array{organization: string, report: string, kind: string}>
     */
    public function handle(CarbonImmutable $today): array
    {
        $anomalies = [];

        foreach ($this->grandLivre->organizationsWithOwnerFunds() as $organisation) {
            $this->contexte->run($organisation, function () use ($organisation, $today, &$anomalies): void {
                $rapports = ManagementReport::query()->where('status', ReportStatus::Published->value)->where('period_end', '>=', $today->subDays(self::JOURS)->toDateString())->orderBy('id')->get();

                foreach ($rapports as $rapport) {
                    $genre = $this->constat($rapport);

                    if ($genre === null) {
                        continue;
                    }

                    $anomalies[] = ['organization' => $organisation, 'report' => $rapport->id, 'kind' => $genre];
                    Log::critical('Anomalie d\'un compte rendu publié', ['organization_id' => $organisation, 'report_id' => $rapport->id, 'kind' => $genre]);
                    $this->audit->handle('reporting.verify.anomaly', subject: $rapport, metadata: ['kind' => $genre]);
                }
            });
        }

        return $anomalies;
    }

    private function constat(ManagementReport $rapport): ?string
    {
        if ($rapport->number === null || $rapport->stored_file_id === null || $rapport->issued_document_id === null) {
            return self::INCOMPLET;
        }

        $contenu = $rapport->content;
        $sections = is_array($contenu['sections'] ?? null) ? array_values(array_map(strval(...), $contenu['sections'])) : [];
        $recalcule = $this->calcul->compute($rapport->mandant_party_id, $rapport->period(), $sections, $rapport->options);

        return hash_equals((string) $rapport->fingerprint, $recalcule->fingerprint) ? null : self::ECART;
    }
}
