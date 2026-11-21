<?php

declare(strict_types=1);

namespace App\Modules\Leases\PublicApi;

use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\Data\LeaseTermLineData;
use App\Modules\Leases\Queries\BillingOrganizations;
use App\Modules\Leases\Queries\LeaseSummaries;
use App\Modules\Leases\Queries\ScheduleLines;
use Carbon\CarbonImmutable;

/**
 * Ce que Rent lit pour échéancer un bail ; suppose un contexte d'organisation.
 */
final readonly class LeaseSchedule
{
    public function __construct(
        private LeaseSummaries $resumes,
        private ScheduleLines $lignes,
        private BillingOrganizations $organisations,
    ) {}

    /**
     * Lève lease_not_found hors de l'organisation courante.
     */
    public function billing(string $leaseId): LeaseBillingData
    {
        return $this->resumes->billing($leaseId);
    }

    /**
     * Lignes de composantes en vigueur sur $from..$to, les deux jours compris (une ligne vaut de valid_from inclus à valid_to exclu).
     * Lève lease_not_found hors de l'organisation courante et lease_period_invalid si $to précède $from.
     *
     * @return list<LeaseTermLineData>
     */
    public function linesBetween(string $leaseId, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $this->lignes->between($leaseId, $from, $to);
    }

    /**
     * Comme `linesBetween` pour plusieurs baux, en un nombre constant de requêtes ; un bail inconnu ou sans ligne est absent du résultat.
     *
     * @param  list<string>  $leaseIds
     * @return array<string, list<LeaseTermLineData>> par identifiant de bail
     */
    public function linesBetweenMany(array $leaseIds, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $this->lignes->betweenMany($leaseIds, $from, $to);
    }

    /**
     * Baux signés en cours sur $from..$to, par identifiant croissant : repartir de l'identifiant du dernier bail reçu.
     * $limit est plafonné à 500. Lève lease_period_invalid si $to précède $from.
     *
     * @return list<LeaseBillingData>
     */
    public function activeBetween(CarbonImmutable $from, CarbonImmutable $to, ?string $afterId, int $limit): array
    {
        return $this->resumes->activeBetween($from, $to, $afterId, $limit);
    }

    /**
     * Organisations qui ont au moins un bail signé en cours sur $from..$to ; seule lecture de LeaseSchedule qui ne suppose
     * pas de contexte d'organisation, pour les tâches planifiées.
     *
     * @return list<string>
     */
    public function organizationsWithActiveLeases(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $this->organisations->between($from, $to);
    }
}
