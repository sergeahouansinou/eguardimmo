<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Cards;

use App\Modules\Reporting\Support\Months;
use Carbon\CarbonImmutable;

final readonly class LandlordCard
{
    private const int LEASE_DAYS = 90;

    private const int CERTIFICATE_DAYS = 60;

    public function __construct(private RentKpis $loyers, private Facts $faits) {}

    /**
     * @return array<string, mixed>
     */
    public function of(?string $mois, CarbonImmutable $today): array
    {
        [$mois, $debut, $fin] = Months::bounds($mois, $today);

        return [
            'month' => $mois,
            ...$this->loyers->of($debut, $fin),
            'leases_ending' => $this->faits->leasesEnding($today, self::LEASE_DAYS),
            'vacant_units' => $this->faits->vacantUnits($today),
            'open_interventions' => $this->faits->openInterventions(),
            'certificates_to_renew' => $this->faits->certificatesToRenew($today, self::CERTIFICATE_DAYS),
        ];
    }
}
