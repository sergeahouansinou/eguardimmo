<?php

declare(strict_types=1);

namespace App\Modules\Leases\PublicApi;

use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\Data\OccupancyData;
use App\Modules\Leases\Data\OccupiedPeriodData;
use App\Modules\Leases\Data\TenantLeaseKeyData;
use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\Queries\Leases;
use App\Modules\Leases\Queries\LeaseSummaries;
use App\Modules\Leases\Queries\TenantLeases;
use App\Modules\Leases\Queries\TenantStandings;
use App\Modules\Leases\Queries\UnitOccupations;
use Carbon\CarbonImmutable;

/**
 * Lecture des baux pour les autres modules ; suppose un contexte d'organisation.
 */
final readonly class LeaseDirectory
{
    public function __construct(
        private LeaseSummaries $resumes,
        private TenantLeases $bauxDuLocataire,
        private Leases $baux,
        private UnitOccupations $occupations,
        private TenantStandings $positions,
    ) {}

    /**
     * Lève lease_not_found hors de l'organisation courante.
     */
    public function find(string $leaseId): LeaseData
    {
        return $this->resumes->one($leaseId);
    }

    /**
     * Verrou d'écriture sur le bail (dans la transaction de l'appelant) : sérialise les mouvements du dépôt de garantie, puis
     * lecture du bail. Lève lease_not_found hors de l'organisation courante.
     */
    public function lock(string $leaseId): LeaseData
    {
        $this->baux->locked($leaseId);

        return $this->resumes->one($leaseId);
    }

    /**
     * Baux qu'un compte locataire peut lire (ADR 0024) : couple (organisation, partie) rattaché au compte, rôle de locataire,
     * bail signé ou terminé, période de grâce comprise. Ne suppose aucun contexte d'organisation : l'appelant s'en sert pour
     * restreindre ses propres lectures, jamais l'inverse.
     *
     * @return list<TenantLeaseKeyData>
     */
    public function visibleToTenant(string $userId, CarbonImmutable $today): array
    {
        return $this->bauxDuLocataire->keys($userId, $today);
    }

    /**
     * Position du compte sur ce bail (clé d'écriture de l'espace locataire, ADR 0036 invariant 1) ; null hors de la clé, l'appelant répond 404.
     * Ne suppose aucun contexte d'organisation.
     */
    public function tenantStanding(string $userId, string $leaseId, CarbonImmutable $today): ?TenantStandingData
    {
        return $this->positions->find($userId, $leaseId, $today);
    }

    /**
     * Lève lease_not_found si un identifiant est inconnu ou hors de l'organisation courante. Ordre et doublons : ceux de $ids, doublons écartés.
     *
     * @param  list<string>  $ids
     * @return list<LeaseData>
     */
    public function findMany(array $ids): array
    {
        return $this->resumes->many($ids);
    }

    /**
     * Baux signés qui occupent ces lots à cette date ; périodes semi-ouvertes, la date de fin n'en fait plus partie.
     * Un lot libre n'apparaît pas : « vacant » se déduit de l'absence de ligne.
     *
     * @param  list<string>  $unitIds
     * @return list<OccupancyData>
     */
    public function occupancyAt(array $unitIds, CarbonImmutable $date): array
    {
        return $this->resumes->occupancyAt($unitIds, $date);
    }

    /**
     * Occupations de ces lots par des baux signés qui recouvrent [from, toExclusive), bornées à cette fenêtre.
     *
     * @param  list<string>  $unitIds
     * @return list<OccupiedPeriodData>
     */
    public function occupiedBetween(array $unitIds, CarbonImmutable $from, CarbonImmutable $toExclusive): array
    {
        if ($unitIds === []) {
            return [];
        }

        $debut = $from->toDateString();
        $fin = $toExclusive->toDateString();
        $periodes = [];

        foreach ($this->occupations->of(array_values(array_unique($unitIds))) as $occupation) {
            if (! $this->occupations->overlap($occupation['from'], $occupation['to'], $debut, $fin)) {
                continue;
            }

            $periodes[] = new OccupiedPeriodData(
                unitId: $occupation['unit_id'],
                leaseId: $occupation['lease_id'],
                from: max($occupation['from'], $debut),
                to: $occupation['to'] === null ? $fin : min($occupation['to'], $fin),
            );
        }

        return $periodes;
    }
}
