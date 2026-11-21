<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Cards;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Carbon\CarbonImmutable;

final readonly class AgingCard
{
    public function __construct(private LedgerAggregates $grandLivre, private OrganizationDirectory $organisations) {}

    /**
     * @return array<string, mixed>
     */
    public function of(CarbonImmutable $today): array
    {
        $devise = $this->organisations->currency();
        $anciennete = $this->grandLivre->outstandingAging($devise, $today);
        $code = $devise->getCode();
        $tranches = [];

        foreach ($anciennete->buckets as $tranche) {
            $tranches[] = ['bucket' => $tranche->key, 'amount' => ['amount' => (int) $tranche->amount->getAmount(), 'currency' => $code], 'count' => $tranche->count];
        }

        return [
            'as_of' => $today->toDateString(),
            'currency' => $code,
            'buckets' => $tranches,
            'total' => ['amount' => (int) $anciennete->total->getAmount(), 'currency' => $code],
            'count' => $anciennete->count,
        ];
    }
}
