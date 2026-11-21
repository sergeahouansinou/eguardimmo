<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Leases\Data\TenantLeaseKeyData;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Models\Intervention;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Interventions que le locataire lit : celles des baux que Leases lui rend visibles (ADR 0024), par couple (organisation, bail)
 * qui ne vient jamais du client. Hors clé, l'intervention n'existe pas pour lui.
 */
final readonly class TenantInterventions
{
    /**
     * @param  list<TenantLeaseKeyData>  $cles
     * @return CursorPaginator<int, Intervention>
     */
    public function page(array $cles, ?string $curseur, int $parPage): CursorPaginator
    {
        return $this->visible($cles)->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: $curseur === null ? null : Cursor::fromEncoded($curseur));
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     */
    public function get(array $cles, string $id): Intervention
    {
        return (Str::isUuid($id) ? $this->visible($cles)->whereKey($id)->first() : null) ?? throw ErrorCode::InterventionNotFound->problem();
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     */
    public function key(array $cles, string $leaseId): TenantLeaseKeyData
    {
        foreach ($cles as $cle) {
            if ($cle->leaseId === $leaseId) {
                return $cle;
            }
        }

        throw ErrorCode::LeaseNotFound->problem();
    }

    /**
     * @param  list<TenantLeaseKeyData>  $cles
     * @return Builder<Intervention>
     */
    private function visible(array $cles): Builder
    {
        $requete = AcrossOrganizations::query(Intervention::class);

        if ($cles === []) {
            return $requete->whereRaw('1 = 0');
        }

        $parOrganisation = [];

        foreach ($cles as $cle) {
            $parOrganisation[$cle->organizationId][] = $cle->leaseId;
        }

        return $requete->where(function (Builder $groupe) use ($parOrganisation): void {
            foreach ($parOrganisation as $organisationId => $baux) {
                $groupe->orWhere(fn (Builder $paire) => $paire->where('organization_id', $organisationId)->whereIn('lease_id', $baux));
            }
        });
    }
}
