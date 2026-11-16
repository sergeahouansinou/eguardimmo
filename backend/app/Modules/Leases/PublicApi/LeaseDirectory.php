<?php

declare(strict_types=1);

namespace App\Modules\Leases\PublicApi;

use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\Data\OccupancyData;
use App\Modules\Leases\Queries\LeaseSummaries;
use Carbon\CarbonImmutable;

/**
 * Lecture des baux pour les autres modules ; suppose un contexte d'organisation.
 */
final readonly class LeaseDirectory
{
    public function __construct(private LeaseSummaries $resumes) {}

    /**
     * Lève lease_not_found hors de l'organisation courante.
     */
    public function find(string $leaseId): LeaseData
    {
        return $this->resumes->one($leaseId);
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
}
