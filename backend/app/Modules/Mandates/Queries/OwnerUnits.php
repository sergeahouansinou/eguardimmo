<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\OwnerCoverageData;
use App\Modules\Mandates\Data\OwnerScopeData;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Pagination\Paginator;

/**
 * Lots couverts par un mandat des mandants lisibles, un par (organisation, lot) : la couverture est déjà calculée par
 * `OwnerCoverage`, la pagination par curseur se fait sur ses lignes triées par lot puis organisation.
 */
final readonly class OwnerUnits
{
    /**
     * @return CursorPaginator<int, array{organization_id: string, unit_id: string}>
     */
    public function page(OwnerScopeData $portee, int $parPage, ?string $curseur): CursorPaginator
    {
        $cursor = $curseur === null ? null : Cursor::fromEncoded($curseur);
        $apres = $cursor?->parameter('unit_id').'|'.$cursor?->parameter('organization_id');
        $lots = [];

        foreach ($portee->coverages as $couverture) {
            $lots[$couverture->unitId.'|'.$couverture->organizationId] = ['organization_id' => $couverture->organizationId, 'unit_id' => $couverture->unitId];
        }

        ksort($lots, SORT_STRING);

        if ($cursor?->pointsToPreviousItems() === true) {
            $lots = array_reverse(array_filter($lots, fn (string $cle): bool => strcmp($cle, $apres) < 0, ARRAY_FILTER_USE_KEY), true);
        } elseif ($cursor !== null) {
            $lots = array_filter($lots, fn (string $cle): bool => strcmp($cle, $apres) > 0, ARRAY_FILTER_USE_KEY);
        }

        return new CursorPaginator(array_slice(array_values($lots), 0, $parPage + 1), $parPage, $cursor, [
            'path' => Paginator::resolveCurrentPath(),
            'parameters' => ['unit_id', 'organization_id'],
        ]);
    }

    /**
     * @return list<OwnerCoverageData>
     */
    public function coverages(OwnerScopeData $portee, string $organizationId, string $unitId): array
    {
        return array_values(array_filter(
            $portee->coverages,
            fn (OwnerCoverageData $c): bool => $c->organizationId === $organizationId && $c->unitId === $unitId,
        ));
    }

    /**
     * Les lots d'un identifiant, une entrée par organisation qui le couvre pour ce compte.
     *
     * @return array{organization_id: string, unit_id: string}|null
     */
    public function find(OwnerScopeData $portee, string $unitId): ?array
    {
        foreach ($portee->coverages as $couverture) {
            if ($couverture->unitId === strtolower($unitId)) {
                return ['organization_id' => $couverture->organizationId, 'unit_id' => $couverture->unitId];
            }
        }

        return null;
    }
}
