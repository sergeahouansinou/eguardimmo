<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\LeaseParty;
use Illuminate\Database\Eloquent\Builder;

/**
 * Locataires comptés pour le plafond du plan (ADR 0013) : personnes distinctes portant le rôle locataire, aujourd'hui ou plus tard,
 * sur un bail brouillon ou signé non archivé. Suppose un contexte d'organisation.
 */
final readonly class TenantCounts
{
    public function distinct(?string $exceptLeaseId = null): int
    {
        return $this->counted($exceptLeaseId)->distinct()->count('lease_parties.party_id');
    }

    /**
     * @param  list<string>  $partyIds
     */
    public function among(array $partyIds, ?string $exceptLeaseId = null): int
    {
        return $partyIds === [] ? 0 : $this->counted($exceptLeaseId)->whereIn('lease_parties.party_id', $partyIds)->distinct()->count('lease_parties.party_id');
    }

    /**
     * Locataires en vigueur ou à venir d'un bail, selon ses lignes.
     *
     * @return list<string>
     */
    public function ofLease(string $leaseId): array
    {
        /** @var list<string> */
        return LeaseParty::query()
            ->where('lease_parties.lease_id', $leaseId)
            ->where('lease_parties.role', LeasePartyRole::Tenant->value)
            ->where(fn (Builder $e) => $e->whereNull('lease_parties.valid_to')->orWhere('lease_parties.valid_to', '>', now()->toDateString()))
            ->distinct()->pluck('lease_parties.party_id')->all();
    }

    /**
     * @return Builder<LeaseParty>
     */
    private function counted(?string $exceptLeaseId): Builder
    {
        return LeaseParty::query()
            ->join('leases', fn ($j) => $j->on('leases.id', '=', 'lease_parties.lease_id')->on('leases.organization_id', '=', 'lease_parties.organization_id'))
            ->where('lease_parties.role', LeasePartyRole::Tenant->value)
            ->where(fn (Builder $e) => $e->whereNull('lease_parties.valid_to')->orWhere('lease_parties.valid_to', '>', now()->toDateString()))
            ->whereNull('leases.archived_at')
            ->whereIn('leases.status', [LeaseStatus::Draft->value, LeaseStatus::Signed->value])
            ->when($exceptLeaseId !== null, fn (Builder $q) => $q->where('lease_parties.lease_id', '<>', $exceptLeaseId));
    }
}
