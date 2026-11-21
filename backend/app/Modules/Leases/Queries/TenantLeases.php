<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Data\TenantLeaseKeyData;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Support\DateCursor;
use App\Modules\Leases\Support\GracePeriod;
use App\Modules\Parties\Data\LinkedPartyData;
use App\Modules\Parties\PublicApi\PartyLinks;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Baux d'un locataire, toutes organisations confondues (ADR 0006, 0024). La clé de lecture est le couple (organisation, partie)
 * rattaché au compte, jamais un identifiant fourni par le client. Un bail hors de cette clé, ou au-delà de la période
 * de grâce, n'existe pas : l'appelant répond 404 sans distinguer les deux.
 */
final readonly class TenantLeases
{
    public function __construct(private PartyLinks $liens) {}

    /**
     * @return CursorPaginator<int, Lease>
     */
    public function page(string $userId, int $parPage, ?string $curseur, CarbonImmutable $today): CursorPaginator
    {
        return $this->visible($userId, $today)
            ->orderByDesc('starts_on')
            ->orderByDesc('id')
            ->cursorPaginate($parPage, cursor: DateCursor::decode($curseur, 'starts_on'));
    }

    public function find(string $userId, string $leaseId, CarbonImmutable $today): ?Lease
    {
        return Str::isUuid($leaseId) ? $this->visible($userId, $today)->whereKey($leaseId)->first() : null;
    }

    /**
     * Couples (organisation, bail) visibles du compte : la clé que les autres modules appliquent à leurs propres lectures.
     *
     * @return list<TenantLeaseKeyData>
     */
    public function keys(string $userId, CarbonImmutable $today): array
    {
        $liens = $this->liens->linkedTo($userId);

        return array_values($this->visible($userId, $today)
            ->addSelect(['leases.id', 'leases.organization_id'])
            ->selectSub($this->exitDate($liens), 'exited_on')
            ->get()
            ->map(fn (Lease $bail): TenantLeaseKeyData => new TenantLeaseKeyData($bail->organization_id, $bail->id, $bail->getAttribute('exited_on') === null ? null : (string) $bail->getAttribute('exited_on')))
            ->all());
    }

    /**
     * Sortie de la ligne du compte : la plus tardive de ses lignes locataire, null dès qu'une ligne reste ouverte.
     *
     * @param  list<LinkedPartyData>  $liens
     */
    private function exitDate(array $liens): QueryBuilder
    {
        return DB::table('lease_parties')
            ->selectRaw('CASE WHEN COUNT(*) = COUNT(lease_parties.valid_to) THEN MAX(lease_parties.valid_to) END')
            ->whereColumn('lease_parties.lease_id', 'leases.id')
            ->whereColumn('lease_parties.organization_id', 'leases.organization_id')
            ->where('lease_parties.role', LeasePartyRole::Tenant->value)
            ->where(function (QueryBuilder $q) use ($liens): void {
                foreach ($liens as $lien) {
                    $q->orWhere(fn (QueryBuilder $paire) => $this->pair($paire, $lien));
                }
            });
    }

    /**
     * Parties du compte, par organisation.
     *
     * @return array<string, list<string>>
     */
    public function partiesByOrganization(string $userId): array
    {
        $parties = [];

        foreach ($this->liens->linkedTo($userId) as $lien) {
            $parties[$lien->organizationId][] = $lien->partyId;
        }

        return $parties;
    }

    /**
     * @return Builder<Lease>
     */
    private function visible(string $userId, CarbonImmutable $today): Builder
    {
        $liens = $this->liens->linkedTo($userId);
        $coupure = GracePeriod::cutoff($today);
        $requete = AcrossOrganizations::query(Lease::class);

        if ($liens === []) {
            return $requete->whereRaw('1 = 0');
        }

        return $requete
            ->where(fn (Builder $q) => $q
                ->where('status', LeaseStatus::Signed->value)
                ->orWhere(fn (Builder $t) => $t->where('status', LeaseStatus::Terminated->value)->whereNotNull('ends_on')))
            ->where(fn (Builder $q) => $q->whereNull('ends_on')->orWhere('ends_on', '>', $coupure))
            ->where(fn (Builder $q) => $q->whereNull('notice_departure_on')->orWhere('notice_departure_on', '>', $coupure))
            ->whereExists(fn (QueryBuilder $ligne) => $ligne
                ->selectRaw('1')
                ->from('lease_parties')
                ->whereColumn('lease_parties.lease_id', 'leases.id')
                ->whereColumn('lease_parties.organization_id', 'leases.organization_id')
                ->where('lease_parties.role', LeasePartyRole::Tenant->value)
                ->where(fn (QueryBuilder $q) => $q->whereNull('lease_parties.valid_to')->orWhere('lease_parties.valid_to', '>', $coupure))
                ->where(function (QueryBuilder $q) use ($liens): void {
                    foreach ($liens as $lien) {
                        $q->orWhere(fn (QueryBuilder $paire) => $this->pair($paire, $lien));
                    }
                }));
    }

    private function pair(QueryBuilder $requete, LinkedPartyData $lien): void
    {
        $requete->where('lease_parties.organization_id', $lien->organizationId)->where('lease_parties.party_id', $lien->partyId);
    }
}
