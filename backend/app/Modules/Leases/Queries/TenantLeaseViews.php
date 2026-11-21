<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Support\GracePeriod;
use App\Modules\Leases\Support\LeaseView;
use App\Modules\Leases\Support\TenantLeaseView;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Résout des baux déjà jugés visibles (TenantLeases). Chaque organisation se lit dans son propre contexte : les requêtes
 * restent celles du module, cloisonnées, et leur nombre croît avec le nombre d'organisations, pas de baux.
 */
final readonly class TenantLeaseViews
{
    public function __construct(
        private TenantLeases $baux,
        private LeaseViews $vues,
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
    ) {}

    /**
     * Résumé de liste : lot principal et lignes du locataire seulement.
     *
     * @param  iterable<Lease>  $baux
     * @return list<TenantLeaseView>
     */
    public function summaries(string $userId, iterable $baux, CarbonImmutable $today): array
    {
        return $this->resolve($userId, $baux, $today, false);
    }

    /**
     * Détail : lots, parties en vigueur et composantes en vigueur au jour de référence du bail.
     */
    public function detail(string $userId, Lease $bail, CarbonImmutable $today): TenantLeaseView
    {
        return $this->resolve($userId, [$bail], $today, true)[0];
    }

    /**
     * @param  iterable<Lease>  $baux
     * @return list<TenantLeaseView>
     */
    private function resolve(string $userId, iterable $baux, CarbonImmutable $today, bool $complet): array
    {
        $baux = array_values([...$baux]);
        $miennes = $this->baux->partiesByOrganization($userId);
        $noms = $this->organisations->names(array_values(array_unique(array_map(fn (Lease $b): string => $b->organization_id, $baux))));
        $vues = [];

        foreach ($this->parOrganisation($baux) as $organisationId => $groupe) {
            $mesParties = $miennes[$organisationId] ?? [];
            $this->contexte->run($organisationId, function () use ($groupe, $mesParties, $today, $complet, $noms, $organisationId, &$vues): void {
                foreach ($this->chargees($groupe, $mesParties, $today, $complet) as $vue) {
                    $vues[$vue->lease->id] = $this->tenantView($vue, $noms[$organisationId] ?? null, $mesParties, $today);
                }
            });
        }

        return array_map(fn (Lease $bail): TenantLeaseView => $vues[$bail->id], $baux);
    }

    /**
     * @param  list<Lease>  $groupe
     * @param  list<string>  $mesParties
     * @return list<LeaseView>
     */
    private function chargees(array $groupe, array $mesParties, CarbonImmutable $today, bool $complet): array
    {
        $collection = (new Lease)->newCollection($groupe);

        $collection->load([
            'units' => fn ($q) => $complet ? $q->orderBy('valid_from')->orderBy('id') : $q->where('is_main', true)->orderBy('valid_from')->orderBy('id'),
            'parties' => fn ($q) => $complet
                ? $q->orderBy('valid_from')->orderBy('id')
                : $q->where('role', LeasePartyRole::Tenant->value)->whereIn('party_id', $mesParties)->orderBy('valid_from')->orderBy('id'),
        ]);

        if ($complet) {
            $jour = $this->referenceDay($groupe[0], $today)->toDateString();
            $collection->load(['terms' => fn ($q) => $q
                ->where('valid_from', '<=', $jour)
                ->where(fn (Builder $e) => $e->whereNull('valid_to')->orWhere('valid_to', '>', $jour))
                ->orderBy('valid_from')->orderBy('id')]);
        }

        return $this->vues->of($collection, $today, $complet ? $this->referenceDay($groupe[0], $today) : null);
    }

    /**
     * @param  list<string>  $mesParties
     */
    private function tenantView(LeaseView $vue, ?string $nomOrganisation, array $mesParties, CarbonImmutable $today): TenantLeaseView
    {
        $mesLignes = array_values(array_filter(
            $vue->parties,
            fn (LeaseParty $ligne): bool => $ligne->role === LeasePartyRole::Tenant && in_array($ligne->party_id, $mesParties, true),
        ));
        $finDuBail = $vue->lease->effectiveEnd();
        $fin = $mesLignes === [] ? null : $this->accessEnd($finDuBail, $mesLignes);
        $dernierJour = $fin === null ? null : CarbonImmutable::parse($fin)->subDay()->toDateString();

        return new TenantLeaseView(
            view: $vue,
            organizationName: $nomOrganisation,
            accessUntil: $dernierJour === null ? null : GracePeriod::until($dernierJour),
            inGrace: $dernierJour !== null && $today->toDateString() > $dernierJour,
            myPartyIds: array_values(array_unique(array_map(fn (LeaseParty $l): string => $l->party_id, $mesLignes))),
        );
    }

    /**
     * Fin d'occupation exclue la plus tardive de ses lignes, chacune bornée par la fin du bail ; null si l'une est sans fin.
     *
     * @param  list<LeaseParty>  $lignes
     */
    private function accessEnd(?string $finDuBail, array $lignes): ?string
    {
        $plusTardive = null;

        foreach ($lignes as $ligne) {
            $candidates = array_filter([$finDuBail, $ligne->valid_to?->toDateString()]);

            if ($candidates === []) {
                return null;
            }

            $fin = min($candidates);
            $plusTardive = $plusTardive === null || $fin > $plusTardive ? $fin : $plusTardive;
        }

        return $plusTardive;
    }

    /**
     * Les conditions affichées sont celles du jour, ramenées dans la vie du bail : début s'il n'a pas commencé, dernier jour s'il est fini.
     */
    private function referenceDay(Lease $bail, CarbonImmutable $today): CarbonImmutable
    {
        $debut = CarbonImmutable::parse($bail->starts_on->toDateString());
        $fin = $bail->effectiveEnd();
        $jour = $today->max($debut);

        return $fin === null ? $jour : $jour->min(CarbonImmutable::parse($fin)->subDay());
    }

    /**
     * @param  list<Lease>  $baux
     * @return array<string, list<Lease>>
     */
    private function parOrganisation(array $baux): array
    {
        $groupes = [];

        foreach ($baux as $bail) {
            $groupes[$bail->organization_id][] = $bail;
        }

        return $groupes;
    }
}
