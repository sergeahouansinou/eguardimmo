<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Data;

use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Ce qu'un compte propriétaire peut lire : les couples (organisation, mandant) de `visibleToOwner()` et les lots que leurs mandats
 * couvrent, jamais un identifiant fourni par le client. Les autres modules en tirent leurs filtres (ADR 0032).
 */
final readonly class OwnerScopeData
{
    /**
     * @param  list<OwnerVisibleData>  $visibles
     * @param  list<OwnerCoverageData>  $coverages
     */
    public function __construct(public array $visibles, public array $coverages) {}

    /**
     * Restreint une lecture aux couples (organisation, mandant) de la clé : jamais l'un sans l'autre, un mandant homonyme
     * d'une autre organisation ne passe pas. Sans couple, rien ne sort.
     *
     * @template TBuilder of EloquentBuilder<*>|QueryBuilder
     *
     * @param  TBuilder  $requete
     * @param  list<string>|null  $roles  valeurs de rôle admises ; null : tous
     * @return TBuilder
     */
    public function restrictToMandants(EloquentBuilder|QueryBuilder $requete, string $colonneOrganisation, string $colonneMandant, ?array $roles = null): EloquentBuilder|QueryBuilder
    {
        $visibles = array_filter($this->visibles, fn (OwnerVisibleData $v): bool => $roles === null || in_array($v->role->value, $roles, true));

        if ($visibles === []) {
            $requete->whereRaw('1 = 0');

            return $requete;
        }

        $parOrganisation = [];

        foreach ($visibles as $visible) {
            $parOrganisation[$visible->organizationId][] = $visible->mandantPartyId;
        }

        $requete->where(function ($groupe) use ($parOrganisation, $colonneOrganisation, $colonneMandant): void {
            foreach ($parOrganisation as $organisationId => $mandants) {
                $groupe->orWhere(fn ($paire) => $paire->where($colonneOrganisation, $organisationId)->whereIn($colonneMandant, array_values(array_unique($mandants))));
            }
        });

        return $requete;
    }

    /**
     * Restreint une lecture aux lots couverts : couple (organisation, lot), sans tenir compte des dates de couverture.
     *
     * @template TBuilder of EloquentBuilder<*>|QueryBuilder
     *
     * @param  TBuilder  $requete
     * @return TBuilder
     */
    public function restrictToUnits(EloquentBuilder|QueryBuilder $requete, string $colonneOrganisation, string $colonneLot): EloquentBuilder|QueryBuilder
    {
        if ($this->coverages === []) {
            $requete->whereRaw('1 = 0');

            return $requete;
        }

        $requete->where(function ($groupe) use ($colonneOrganisation, $colonneLot): void {
            foreach ($this->organizationIds() as $organisationId) {
                $groupe->orWhere(fn ($paire) => $paire->where($colonneOrganisation, $organisationId)->whereIn($colonneLot, $this->unitIds($organisationId)));
            }
        });

        return $requete;
    }

    public function isEmpty(): bool
    {
        return $this->visibles === [];
    }

    /**
     * @return list<string>
     */
    public function organizationIds(): array
    {
        return array_values(array_unique(array_map(fn (OwnerVisibleData $v): string => $v->organizationId, $this->visibles)));
    }

    /**
     * @return list<string>
     */
    public function mandantIds(string $organizationId): array
    {
        return array_values(array_unique(array_map(
            fn (OwnerVisibleData $v): string => $v->mandantPartyId,
            array_filter($this->visibles, fn (OwnerVisibleData $v): bool => $v->organizationId === $organizationId),
        )));
    }

    public function visible(string $organizationId, string $mandantPartyId): ?OwnerVisibleData
    {
        foreach ($this->visibles as $visible) {
            if ($visible->organizationId === $organizationId && $visible->mandantPartyId === $mandantPartyId) {
                return $visible;
            }
        }

        return null;
    }

    /**
     * Lots couverts dans une organisation, regroupés par période de couverture : clé `from|to`, une entrée par fenêtre.
     *
     * @return array<string, array{from: string, to: string, units: list<string>}>
     */
    public function windows(string $organizationId): array
    {
        $fenetres = [];

        foreach ($this->coverages as $couverture) {
            if ($couverture->organizationId !== $organizationId) {
                continue;
            }

            $cle = $couverture->from.'|'.$couverture->to;
            $fenetres[$cle] ??= ['from' => $couverture->from, 'to' => $couverture->to, 'units' => []];
            $fenetres[$cle]['units'][$couverture->unitId] = $couverture->unitId;
        }

        return array_map(fn (array $f): array => ['from' => $f['from'], 'to' => $f['to'], 'units' => array_values($f['units'])], $fenetres);
    }

    /**
     * @return list<OwnerCoverageData>
     */
    public function coveragesOf(string $organizationId): array
    {
        return array_values(array_filter($this->coverages, fn (OwnerCoverageData $c): bool => $c->organizationId === $organizationId));
    }

    /**
     * @return list<string>
     */
    public function unitIds(string $organizationId): array
    {
        $lots = [];

        foreach ($this->coverages as $couverture) {
            if ($couverture->organizationId === $organizationId) {
                $lots[$couverture->unitId] = $couverture->unitId;
            }
        }

        return array_values($lots);
    }

    /**
     * Le mandant du compte qui couvre ce lot ce jour-là (Y-m-d), à défaut celui dont la couverture est la plus proche.
     */
    public function mandantOf(string $organizationId, string $unitId, string $day): ?OwnerVisibleData
    {
        $retenu = null;

        foreach ($this->coverages as $couverture) {
            if ($couverture->organizationId !== $organizationId || $couverture->unitId !== $unitId) {
                continue;
            }

            if ($couverture->from <= $day && $couverture->to >= $day) {
                return $this->visible($organizationId, $couverture->mandantPartyId);
            }

            $retenu ??= $couverture;
        }

        return $retenu === null ? null : $this->visible($organizationId, $retenu->mandantPartyId);
    }
}
