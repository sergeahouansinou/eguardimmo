<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Cards;

use App\Modules\Reporting\Queries\DueReports;
use Carbon\CarbonImmutable;

final readonly class AgencyAlertsCard
{
    private const int RENEWAL_DAYS = 90;

    private const int CERTIFICATE_DAYS = 60;

    private const int DUE_LISTED = 10;

    public function __construct(private Facts $faits, private DueReports $dus) {}

    /**
     * @return array<string, mixed>
     */
    public function of(CarbonImmutable $today): array
    {
        $periode = DueReports::lastPeriod($today);
        $ids = $this->dus->mandantIds($periode['from'], $periode['to']);

        return [
            'mandates_to_renew' => $this->faits->mandatesToRenew($today, self::RENEWAL_DAYS),
            'certificates_to_renew' => $this->faits->certificatesToRenew($today, self::CERTIFICATE_DAYS),
            'reports_due' => [
                'period' => ['start' => $periode['from']->toDateString(), 'end' => $periode['to']->toDateString()],
                'count' => count($ids),
                'mandant_ids' => array_slice($ids, 0, self::DUE_LISTED),
            ],
        ];
    }
}
