<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\Models\LeaseInsuranceSubmission;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

/**
 * Dépôts d'assurance d'un locataire : seulement les siens, jamais l'attestation d'un colocataire (ADR 0036, décision 5).
 */
final readonly class TenantInsuranceSubmissions
{
    public const int MAX = 50;

    public function __construct(private TenantStandings $positions) {}

    /**
     * @return Collection<int, LeaseInsuranceSubmission>
     */
    public function mine(TenantStandingData $position): Collection
    {
        return AcrossOrganizations::query(LeaseInsuranceSubmission::class)
            ->where('organization_id', $position->organizationId)
            ->where('lease_id', $position->leaseId)
            ->where('party_id', $position->partyId)
            ->orderByDesc('id')
            ->limit(self::MAX)
            ->get();
    }

    public function find(string $userId, string $id, CarbonImmutable $today): ?LeaseInsuranceSubmission
    {
        $depot = Str::isUuid($id) ? AcrossOrganizations::query(LeaseInsuranceSubmission::class)->whereKey($id)->first() : null;

        if ($depot === null) {
            return null;
        }

        $position = $this->positions->find($userId, $depot->lease_id, $today);

        return $position !== null && $position->organizationId === $depot->organization_id && $position->partyId === $depot->party_id ? $depot : null;
    }
}
