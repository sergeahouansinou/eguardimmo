<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Models\LeaseParty;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Clé d'écriture de l'espace locataire : un bail hors de `TenantLeases` ou sans ligne de locataire pour le compte
 * n'existe pas (null, l'appelant répond 404).
 */
final readonly class TenantStandings
{
    public function __construct(private TenantLeases $baux) {}

    public function find(string $userId, string $leaseId, CarbonImmutable $today): ?TenantStandingData
    {
        $bail = $this->baux->find($userId, $leaseId, $today);

        if ($bail === null) {
            return null;
        }

        $mesParties = $this->baux->partiesByOrganization($userId)[$bail->organization_id] ?? [];

        if ($mesParties === []) {
            return null;
        }

        /** @var Builder<LeaseParty> $lignes */
        $lignes = AcrossOrganizations::query(LeaseParty::class);
        $ligne = $lignes
            ->where('organization_id', $bail->organization_id)
            ->where('lease_id', $bail->id)
            ->where('role', LeasePartyRole::Tenant->value)
            ->whereIn('party_id', $mesParties)
            ->orderByRaw('valid_to IS NULL DESC')
            ->orderByDesc('valid_from')
            ->first();

        if ($ligne === null) {
            return null;
        }

        $jour = $today->toDateString();
        $fin = $bail->effectiveEnd();
        $actif = ($fin === null || $fin > $jour) && ($ligne->valid_to === null || $ligne->valid_to->toDateString() > $jour);

        return new TenantStandingData($bail->organization_id, $bail->id, $ligne->party_id, $actif, $ligne->valid_to?->toDateString());
    }
}
