<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries\Cards;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Reporting\Support\Reading;
use Carbon\CarbonImmutable;

final readonly class AgencyPayoutsCard
{
    private const int TOP = 5;

    public function __construct(
        private LedgerAggregates $grandLivre,
        private OrganizationDirectory $organisations,
        private PartyDirectory $parties,
        private Reading $lecture,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function of(CarbonImmutable $today): array
    {
        $devise = $this->organisations->currency();
        $code = $devise->getCode();
        $soldes = $this->grandLivre->allOwnerFunds($devise, $today);
        $dus = array_filter($soldes, fn ($s): bool => $s->payable->isPositive());
        uasort($dus, fn ($a, $b): int => (int) $b->payable->getAmount() <=> (int) $a->payable->getAmount());
        $premiers = array_slice(array_keys($dus), 0, self::TOP);
        $noms = [];

        foreach ($this->parties->findMany($premiers) as $p) {
            $noms[$p->id] = $p->displayName;
        }

        return [
            'currency' => $code,
            'payable_total' => ['amount' => array_sum(array_map(fn ($s): int => (int) $s->payable->getAmount(), $dus)), 'currency' => $code],
            'in_transit_total' => ['amount' => array_sum(array_map(fn ($s): int => (int) $s->inTransit->getAmount(), $soldes)), 'currency' => $code],
            'mandants_with_payable' => count($dus),
            'top_mandants' => array_map(fn (string $id): array => ['party_id' => $id, 'name' => $noms[$id] ?? null, 'payable' => ['amount' => (int) $dus[$id]->payable->getAmount(), 'currency' => $code]], $premiers),
            'active_holds' => $this->lecture->table('payout_holds')->whereNull('released_at')->count(),
            'pending_items' => $this->lecture->table('payout_items')->where('status', 'pending')->count(),
        ];
    }
}
