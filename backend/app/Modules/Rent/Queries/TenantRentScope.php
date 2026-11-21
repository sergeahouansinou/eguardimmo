<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Leases\Data\TenantLeaseKeyData;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Restreint une lecture inter-organisations aux baux que le compte peut voir (ADR 0024) : le couple (organisation, bail)
 * vient de Leases, jamais du client. Sans bail visible, rien ne sort.
 */
final readonly class TenantRentScope
{
    /**
     * @template TModel of Model
     *
     * @param  Builder<TModel>  $requete
     * @param  list<TenantLeaseKeyData>  $cles
     * @return Builder<TModel>
     */
    public function restrict(Builder $requete, array $cles): Builder
    {
        if ($cles === []) {
            return $requete->whereRaw('1 = 0');
        }

        $parOrganisation = [];

        foreach ($cles as $cle) {
            $parOrganisation[$cle->organizationId][] = $cle->leaseId;
        }

        $modele = $requete->getModel();

        return $requete->where(function (Builder $groupe) use ($parOrganisation, $modele): void {
            foreach ($parOrganisation as $organisationId => $baux) {
                $groupe->orWhere(fn (Builder $paire) => $paire
                    ->where($modele->qualifyColumn('organization_id'), $organisationId)
                    ->whereIn($modele->qualifyColumn('lease_id'), $baux));
            }
        });
    }
}
