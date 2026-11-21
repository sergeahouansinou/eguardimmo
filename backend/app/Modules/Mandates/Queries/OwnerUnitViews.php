<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\OwnerCoverageData;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Support\OwnerUnitView;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Properties\Data\UnitData;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use LogicException;
use RuntimeException;

final readonly class OwnerUnitViews
{
    public function __construct(
        private UnitDirectory $lots,
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
    ) {}

    /**
     * @param  list<array{organization_id: string, unit_id: string}>  $cles
     * @return list<OwnerUnitView> dans l'ordre reçu
     */
    public function of(OwnerScopeData $portee, array $cles): array
    {
        $noms = $this->organisations->names(array_values(array_unique(array_column($cles, 'organization_id'))));
        $parOrganisation = [];

        foreach ($cles as $cle) {
            $parOrganisation[$cle['organization_id']][] = $cle['unit_id'];
        }

        $donnees = [];

        foreach ($parOrganisation as $organisationId => $ids) {
            $donnees[$organisationId] = $this->contexte->run($organisationId, fn (): array => $this->resolve($ids));
        }

        $aujourdhui = CarbonImmutable::today()->toDateString();

        $vues = array_map(function (array $cle) use ($portee, $donnees, $noms, $aujourdhui): ?OwnerUnitView {
            $lot = $donnees[$cle['organization_id']][$cle['unit_id']] ?? null;

            if ($lot === null) {
                return null;
            }

            $couvertures = array_values(array_filter(
                $portee->coverages,
                fn (OwnerCoverageData $c): bool => $c->organizationId === $cle['organization_id'] && $c->unitId === $cle['unit_id'],
            ));
            $debuts = array_map(fn (OwnerCoverageData $c): string => $c->from, $couvertures);
            $fins = array_map(fn (OwnerCoverageData $c): string => $c->to, $couvertures);

            if ($debuts === [] || $fins === []) {
                throw new LogicException('Un lot de la page n\'est couvert par aucun mandat de la clé du compte.');
            }

            return new OwnerUnitView(
                unit: $lot,
                organizationId: $cle['organization_id'],
                agencyName: $noms[$cle['organization_id']] ?? null,
                visible: $portee->mandantOf($cle['organization_id'], $cle['unit_id'], $aujourdhui),
                coveredFrom: min($debuts),
                coveredUntil: max($fins),
            );
        }, $cles);

        return array_values(array_filter($vues));
    }

    /**
     * Un lot couvert dont la fiche n'existe plus est ignoré et signalé : il ne fait pas échouer la page des autres.
     *
     * @param  list<string>  $ids
     * @return array<string, UnitData>
     */
    private function resolve(array $ids): array
    {
        try {
            return $this->lots->findMany($ids);
        } catch (ApiProblem) {
            $trouves = [];

            foreach ($ids as $id) {
                try {
                    $trouves += $this->lots->findMany([$id]);
                } catch (ApiProblem) {
                    report(new RuntimeException("Lot couvert sans fiche {$id}."));
                }
            }

            return $trouves;
        }
    }
}
