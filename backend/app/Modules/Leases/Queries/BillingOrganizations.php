<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Support\LeaseOccupancy;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

final readonly class BillingOrganizations
{
    /**
     * Organisations qui ont au moins un bail signé en cours sur $from..$to, par identifiant croissant : sert aux tâches
     * planifiées, qui parcourent ensuite chaque organisation sous son contexte.
     *
     * @return list<string>
     */
    public function between(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return array_values(AcrossOrganizations::query(Lease::class)
            ->tap(fn (Builder $q) => LeaseOccupancy::between($q, $from->toDateString(), $to->toDateString()))
            ->whereNull('archived_at')
            ->distinct()
            ->orderBy('organization_id')
            ->pluck('organization_id')
            ->map(fn (mixed $id): string => (string) $id)
            ->all());
    }
}
