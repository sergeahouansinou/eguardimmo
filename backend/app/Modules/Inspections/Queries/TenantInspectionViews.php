<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Queries;

use App\Modules\Inspections\Models\Inspection;
use App\Modules\Inspections\Support\RemarkWindows;
use App\Modules\Inspections\Support\TenantInspectionView;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

/**
 * Ajoute à des états déjà jugés visibles les types de remarque encore ouverts ; une lecture de bail par organisation, jamais par état.
 */
final readonly class TenantInspectionViews
{
    public function __construct(
        private CurrentOrganization $contexte,
        private LeaseDirectory $baux,
    ) {}

    /**
     * @param  list<Inspection>  $etats
     * @return list<TenantInspectionView>
     */
    public function of(array $etats, string $userId, CarbonImmutable $today): array
    {
        $parOrganisation = [];

        foreach ($etats as $etat) {
            $parOrganisation[$etat->organization_id][] = $etat;
        }

        $debuts = [];
        $actifs = [];

        foreach (array_unique(array_map(fn (Inspection $e): string => $e->lease_id, $etats)) as $bailId) {
            $actifs[$bailId] = $this->baux->tenantStanding($userId, $bailId, $today)->active ?? false;
        }

        foreach ($parOrganisation as $organisationId => $groupe) {
            $this->contexte->run($organisationId, function () use ($groupe, &$debuts): void {
                foreach ($this->baux->findMany(array_values(array_unique(array_map(fn (Inspection $e): string => $e->lease_id, $groupe)))) as $bail) {
                    $debuts[$bail->id] = CarbonImmutable::parse($bail->startsOn);
                }
            });
        }

        return array_map(fn (Inspection $etat): TenantInspectionView => new TenantInspectionView(
            $etat,
            isset($debuts[$etat->lease_id]) ? RemarkWindows::open($etat, $actifs[$etat->lease_id], $debuts[$etat->lease_id], $today) : [],
        ), $etats);
    }
}
