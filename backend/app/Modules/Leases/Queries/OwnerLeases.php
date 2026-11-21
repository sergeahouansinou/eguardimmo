<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Support\DateCursor;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Str;

/**
 * Baux des lots couverts par un mandat du compte, toutes organisations confondues (ADR 0006, 0032). La clé vient de
 * `MandateDirectory::ownerScope()`, jamais du client : un bail est visible tant qu'il chevauche la couverture du lot
 * par le mandat du compte, ce qui exclut les baux d'avant et d'après le mandat. Brouillons et baux annulés n'existent pas.
 */
final readonly class OwnerLeases
{
    /**
     * @return CursorPaginator<int, Lease>
     */
    public function page(OwnerScopeData $portee, int $parPage, ?string $curseur): CursorPaginator
    {
        return $this->visible($portee)
            ->orderByDesc('starts_on')
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: DateCursor::decode($curseur, 'starts_on'));
    }

    public function find(OwnerScopeData $portee, string $leaseId): ?Lease
    {
        return Str::isUuid($leaseId) ? $this->visible($portee)->whereKey($leaseId)->first() : null;
    }

    /**
     * @return Builder<Lease>
     */
    private function visible(OwnerScopeData $portee): Builder
    {
        $requete = AcrossOrganizations::query(Lease::class)
            ->whereIn('status', [LeaseStatus::Signed->value, LeaseStatus::Terminated->value]);

        if ($portee->isEmpty()) {
            return $requete->whereRaw('1 = 0');
        }

        return $requete->whereExists(fn (QueryBuilder $ligne) => $ligne
            ->selectRaw('1')
            ->from('lease_units')
            ->whereColumn('lease_units.lease_id', 'leases.id')
            ->whereColumn('lease_units.organization_id', 'leases.organization_id')
            ->where(function (QueryBuilder $groupe) use ($portee): void {
                foreach ($portee->organizationIds() as $organisationId) {
                    foreach ($portee->windows($organisationId) as $fenetre) {
                        $groupe->orWhere(fn (QueryBuilder $paire) => $paire
                            ->where('lease_units.organization_id', $organisationId)
                            ->whereIn('lease_units.unit_id', $fenetre['units'])
                            ->where('lease_units.valid_from', '<=', $fenetre['to'])
                            ->where(fn (QueryBuilder $q) => $q->whereNull('lease_units.valid_to')->orWhere('lease_units.valid_to', '>', $fenetre['from']))
                            ->where('leases.starts_on', '<=', $fenetre['to'])
                            ->where(fn (QueryBuilder $q) => $q->whereNull('leases.ends_on')->orWhere('leases.ends_on', '>', $fenetre['from']))
                            ->where(fn (QueryBuilder $q) => $q->whereNull('leases.notice_departure_on')->orWhere('leases.notice_departure_on', '>', $fenetre['from'])));
                    }
                }
            }));
    }
}
