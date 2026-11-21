<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Cards;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Reporting\Support\Months;
use Carbon\CarbonImmutable;

final readonly class AgencyKpisCard
{
    public function __construct(private RentKpis $loyers, private LedgerAggregates $grandLivre, private OrganizationDirectory $organisations) {}

    /**
     * @return array<string, mixed>
     */
    public function of(?string $mois, CarbonImmutable $today): array
    {
        [$mois, $debut, $fin] = Months::bounds($mois, $today);
        $devise = $this->organisations->currency();
        $honoraires = 0;

        foreach ($this->grandLivre->movements([AccountRole::FeeRevenue], $devise, $debut, $fin) as $m) {
            $honoraires += (int) $m->credit->getAmount() - (int) $m->debit->getAmount();
        }

        return [
            'month' => $mois,
            ...$this->loyers->of($debut, $fin),
            'fees_net' => ['amount' => $honoraires, 'currency' => $devise->getCode()],
            'period_closed' => $this->grandLivre->isClosed($debut),
        ];
    }
}
