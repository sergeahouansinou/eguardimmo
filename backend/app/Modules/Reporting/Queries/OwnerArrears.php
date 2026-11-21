<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Rent\PublicApi\RentLedger;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Impayés de loyer de baux donnés à un jour : échéances échues et non soldées, restes dus lus au grand livre. Suppose le contexte
 * de l'organisation des baux. Un seul appel au grand livre, puis une lecture des échéances pour les seuls baux en retard.
 */
final readonly class OwnerArrears
{
    public function __construct(private LedgerAggregates $grandLivre, private RentLedger $loyers) {}

    /**
     * @param  list<string>  $leaseIds
     * @return array<string, array{amount: int, count: int, days: int}> par bail en retard
     */
    public function byLease(array $leaseIds, Currency $devise, CarbonImmutable $jour): array
    {
        if ($leaseIds === []) {
            return [];
        }

        $dus = $this->grandLivre->dueByLeases($leaseIds, $devise, $jour);
        $retards = [];

        foreach ($leaseIds as $bail) {
            if (! isset($dus[$bail]) || ! $dus[$bail]->isPositive()) {
                continue;
            }

            $retard = ['amount' => 0, 'count' => 0, 'days' => 0];

            foreach ($this->loyers->unpaidInstallments($jour, $bail) as $echeance) {
                $retard['amount'] += (int) $echeance->outstanding->getAmount();
                $retard['count']++;
                $retard['days'] = max($retard['days'], (int) CarbonImmutable::parse($echeance->dueDate)->diffInDays($jour));
            }

            if ($retard['count'] > 0) {
                $retards[$bail] = $retard;
            }
        }

        return $retards;
    }
}
