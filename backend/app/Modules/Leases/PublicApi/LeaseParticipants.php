<?php

declare(strict_types=1);

namespace App\Modules\Leases\PublicApi;

use App\Modules\Leases\Data\LeasePartyData;
use App\Modules\Leases\Queries\PartyLines;
use Carbon\CarbonImmutable;

/**
 * Parties d'un bail pour les autres modules ; suppose un contexte d'organisation.
 */
final readonly class LeaseParticipants
{
    public function __construct(private PartyLines $lignes) {}

    /**
     * Toutes les lignes, sorties comprises. Lève lease_not_found hors de l'organisation courante.
     *
     * @return list<LeasePartyData>
     */
    public function partiesOf(string $leaseId): array
    {
        return $this->lignes->of($leaseId);
    }

    /**
     * Locataires présents à cette date ; la date de départ n'en fait plus partie.
     *
     * @return list<LeasePartyData>
     */
    public function tenantsAt(string $leaseId, CarbonImmutable $date): array
    {
        return $this->lignes->tenantsAt($leaseId, $date);
    }
}
