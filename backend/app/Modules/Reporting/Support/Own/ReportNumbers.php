<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Own;

use App\Modules\Reporting\Jurisdictions\ManagementReportRules;
use App\Shared\Database\ContinuousCounter;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

/**
 * Numéro continu par organisation et par année, pris à la publication sous verrou : un échec en amont ne laisse aucun trou.
 */
final readonly class ReportNumbers
{
    public function __construct(private ContinuousCounter $compteur, private CurrentOrganization $organisation) {}

    public function next(ManagementReportRules $regles, CarbonImmutable $jour): string
    {
        $valeur = $this->compteur->next('management_report_sequences', ['organization_id' => $this->organisation->id(), 'year' => $jour->year]);

        return sprintf('%s-%d-%04d', $regles->numberPrefix(), $jour->year, $valeur);
    }
}
