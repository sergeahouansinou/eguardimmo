<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Data\LeasePartyData;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Models\LeaseParty;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

final readonly class PartyLines
{
    public function __construct(private LeaseSummaries $resumes) {}

    /**
     * @return list<LeasePartyData>
     */
    public function of(string $leaseId): array
    {
        return $this->read($leaseId, fn (Builder $q): Builder => $q);
    }

    /**
     * @return list<LeasePartyData>
     */
    public function tenantsAt(string $leaseId, CarbonImmutable $date): array
    {
        $jour = $date->toDateString();

        return $this->read($leaseId, fn (Builder $q): Builder => $q
            ->where('role', LeasePartyRole::Tenant->value)
            ->where('valid_from', '<=', $jour)
            ->where(fn (Builder $q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $jour)));
    }

    /**
     * @param  callable(Builder<LeaseParty>): Builder<LeaseParty>  $filtre
     * @return list<LeasePartyData>
     */
    private function read(string $leaseId, callable $filtre): array
    {
        $bail = $this->resumes->bail($leaseId);

        return array_values($filtre(LeaseParty::query()->where('lease_id', $bail->id))
            ->orderBy('valid_from')
            ->orderBy('id')
            ->get()
            ->map(fn (LeaseParty $ligne): LeasePartyData => new LeasePartyData(
                id: $ligne->id,
                leaseId: $ligne->lease_id,
                partyId: $ligne->party_id,
                role: $ligne->role,
                jointLiability: $ligne->joint_liability,
                guaranteesPartyId: $ligne->guarantees_party_id,
                guaranteeLimit: $ligne->guarantee_limit_amount,
                guaranteeEndsOn: $ligne->guarantee_ends_on?->toDateString(),
                validFrom: $ligne->valid_from->toDateString(),
                validTo: $ligne->valid_to?->toDateString(),
            ))
            ->all());
    }
}
