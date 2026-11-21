<?php

declare(strict_types=1);

namespace App\Modules\Rent\PublicApi;

use App\Modules\Rent\Data\LeaseProvisionsData;
use App\Modules\Rent\Queries\ProvisionTotals;
use Carbon\CarbonImmutable;

/**
 * Provisions sur charges appelées, pour la régularisation (ADR 0034) ; suppose un contexte d'organisation. Lecture seule.
 */
final readonly class ChargeProvisions
{
    public function __construct(private ProvisionTotals $totaux) {}

    /**
     * Provisions des échéances émises et non annulées dont le mois tombe dans [from, toExclusive[, contrepassations déduites, par bail.
     * « Dont non réglé » vient du grand livre et reste une créance de loyer : il n'entre pas dans le solde de la régularisation.
     *
     * @param  list<string>  $leaseIds
     * @return array<string, LeaseProvisionsData> un bail sans provision appelée est absent
     */
    public function calledBetween(array $leaseIds, CarbonImmutable $from, CarbonImmutable $toExclusive): array
    {
        return $this->totaux->calledBetween($leaseIds, $from, $toExclusive);
    }
}
