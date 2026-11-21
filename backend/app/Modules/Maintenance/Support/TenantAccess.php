<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Leases\Data\TenantLeaseKeyData;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Queries\TenantInterventions;
use App\Modules\Parties\PublicApi\PartyLinks;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Closure;

/**
 * Seule porte d'entrée du locataire : le couple (organisation, bail) vient de Leases, la partie du signalant de Parties, jamais
 * du client ; tout le reste s'exécute sous le contexte de cette organisation.
 */
final readonly class TenantAccess
{
    public function __construct(
        private LeaseDirectory $baux,
        private LeaseParticipants $participants,
        private PartyLinks $liens,
        private TenantInterventions $lecture,
        private CurrentOrganization $contexte,
    ) {}

    /**
     * @return list<TenantLeaseKeyData>
     */
    public function keys(string $userId): array
    {
        return $this->baux->visibleToTenant($userId, CarbonImmutable::today());
    }

    public function intervention(string $userId, string $id): Intervention
    {
        return $this->lecture->get($this->keys($userId), $id);
    }

    /**
     * Partie du compte qui est locataire du bail dans cette organisation.
     */
    public function reporter(string $userId, string $organizationId, string $leaseId): string
    {
        $parties = [];

        foreach ($this->liens->linkedTo($userId) as $lien) {
            if ($lien->organizationId === $organizationId) {
                $parties[$lien->partyId] = true;
            }
        }

        return $this->contexte->run($organizationId, function () use ($parties, $leaseId): string {
            foreach ($this->participants->partiesOf($leaseId) as $ligne) {
                if (isset($parties[$ligne->partyId]) && $ligne->role === LeasePartyRole::Tenant) {
                    return $ligne->partyId;
                }
            }

            throw ErrorCode::LeaseNotFound->problem();
        });
    }

    /**
     * @template T
     *
     * @param  Closure(): T  $travail
     * @return T
     */
    public function within(string $organizationId, Closure $travail): mixed
    {
        return $this->contexte->run($organizationId, $travail);
    }
}
