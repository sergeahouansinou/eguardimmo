<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Models\ManagementReport;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;

final readonly class PublishScheduledReports
{
    public function __construct(
        private CurrentOrganization $contexte,
        private LedgerAggregates $grandLivre,
        private PublishReport $publication,
    ) {}

    /**
     * Publie les comptes rendus générés dont la date planifiée est échue. Un échec (période non close, PDF indisponible) est
     * journalisé et compté ; le compte rendu reste généré et sera retenté au passage suivant.
     *
     * @return array{published: int, failed: int}
     */
    public function handle(CarbonImmutable $now): array
    {
        $bilan = ['published' => 0, 'failed' => 0];

        foreach ($this->grandLivre->organizationsWithOwnerFunds() as $organisation) {
            $this->contexte->run($organisation, function () use ($organisation, $now, &$bilan): void {
                $echus = ManagementReport::query()
                    ->where('status', ReportStatus::Generated->value)->whereNotNull('scheduled_for')->where('scheduled_for', '<=', $now)
                    ->orderBy('scheduled_for')->orderBy('id')->get();

                foreach ($echus as $rapport) {
                    try {
                        $this->publication->handle($rapport, null, $now->startOfDay());
                        $bilan['published']++;
                    } catch (ApiProblem $erreur) {
                        $bilan['failed']++;
                        Log::warning('Publication planifiée refusée', ['organization_id' => $organisation, 'report_id' => $rapport->id, 'code' => $erreur->problemCode]);
                    }
                }
            });
        }

        return $bilan;
    }
}
