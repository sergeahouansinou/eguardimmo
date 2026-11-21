<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Events\ReportsDue;
use App\Modules\Reporting\Jurisdictions\ManagementReportJurisdictions;
use App\Modules\Reporting\Queries\DueReports;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

/**
 * Signale, une fois par mandant et par période (clé de déduplication de la notification), les comptes rendus à produire.
 */
final readonly class FlagDueReports
{
    public function __construct(
        private CurrentOrganization $contexte,
        private LedgerAggregates $grandLivre,
        private OrganizationDirectory $organisations,
        private ManagementReportJurisdictions $juridictions,
        private DueReports $dus,
    ) {}

    /**
     * @return int nombre de mandants signalés
     */
    public function handle(CarbonImmutable $today): int
    {
        $signales = 0;

        foreach ($this->grandLivre->organizationsWithOwnerFunds() as $organisation) {
            $this->contexte->run($organisation, function () use ($organisation, $today, &$signales): void {
                if (! $this->juridictions->supports($this->organisations->country())) {
                    return;
                }

                $periode = DueReports::lastPeriod($today);

                foreach ($this->dus->mandantIds($periode['from'], $periode['to']) as $mandantId) {
                    ReportsDue::dispatch($organisation, $mandantId, $periode['from']->toDateString(), $periode['to']->toDateString());
                    $signales++;
                }
            });
        }

        return $signales;
    }
}
