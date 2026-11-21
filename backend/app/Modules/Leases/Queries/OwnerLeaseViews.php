<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Support\LeaseView;
use App\Modules\Leases\Support\OwnerLeaseScope;
use App\Modules\Leases\Support\OwnerLeaseView;
use App\Modules\Mandates\Data\OwnerCoverageData;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Résout des baux déjà jugés visibles, une organisation après l'autre : le nombre de requêtes croît avec les agences, pas avec les baux.
 * Seuls les locataires sont chargés : jamais un garant, un occupant ni leurs coordonnées.
 */
final readonly class OwnerLeaseViews
{
    public function __construct(
        private LeaseViews $vues,
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
    ) {}

    /**
     * @param  iterable<Lease>  $baux
     * @return list<OwnerLeaseView> dans l'ordre reçu
     */
    public function summaries(OwnerScopeData $portee, iterable $baux, CarbonImmutable $today): array
    {
        return $this->resolve($portee, $baux, $today, false);
    }

    public function detail(OwnerScopeData $portee, Lease $bail, CarbonImmutable $today): OwnerLeaseView
    {
        return $this->resolve($portee, [$bail], $today, true)[0];
    }

    /**
     * @param  iterable<Lease>  $baux
     * @return list<OwnerLeaseView>
     */
    private function resolve(OwnerScopeData $portee, iterable $baux, CarbonImmutable $today, bool $complet): array
    {
        $baux = array_values([...$baux]);
        $noms = $this->organisations->names(array_values(array_unique(array_map(fn (Lease $b): string => $b->organization_id, $baux))));
        $groupes = [];

        foreach ($baux as $bail) {
            $groupes[$bail->organization_id][] = $bail;
        }

        $vues = [];
        $portees = [];

        foreach ($groupes as $organisationId => $groupe) {
            $this->contexte->run($organisationId, function () use ($portee, $organisationId, $groupe, $today, $complet, &$vues, &$portees): void {
                foreach ($this->chargees($portee->coveragesOf($organisationId), $groupe, $today, $complet, $portees) as $vue) {
                    $vues[$vue->lease->id] = $vue;
                }
            });
        }

        return array_map(function (Lease $bail) use ($vues, $portees, $noms, $portee): OwnerLeaseView {
            $vue = $vues[$bail->id];
            $perimetre = $portees[$bail->id];
            $locataires = array_values(array_unique(array_map(fn (LeaseParty $l): string => $l->party_id, $vue->tenants())));
            $ligne = $vue->mainUnit() ?? ($vue->units[0] ?? null);

            return new OwnerLeaseView(
                view: $vue,
                agencyName: $noms[$bail->organization_id] ?? null,
                visible: $ligne === null ? null : $portee->mandantOf($bail->organization_id, $ligne->unit_id, $perimetre->day->toDateString()),
                tenantPartyIds: $locataires,
                scope: $perimetre,
            );
        }, $baux);
    }

    /**
     * @param  list<OwnerCoverageData>  $couvertures
     * @param  list<Lease>  $groupe
     * @param  array<string, OwnerLeaseScope>  $portees  rempli par bail
     * @return list<LeaseView>
     */
    private function chargees(array $couvertures, array $groupe, CarbonImmutable $today, bool $complet, array &$portees): array
    {
        $collection = (new Lease)->newCollection($groupe);
        $collection->load([
            'units' => fn ($q) => $q->orderBy('valid_from')->orderBy('id'),
            'parties' => fn ($q) => $q->where('role', LeasePartyRole::Tenant->value)->orderBy('valid_from')->orderBy('id'),
        ]);

        foreach ($groupe as $bail) {
            $perimetre = OwnerLeaseScope::of($bail, $bail->units, $couvertures, $today);
            $portees[$bail->id] = $perimetre;
            $bail->setRelation('units', (new LeaseUnit)->newCollection($perimetre->units));
            $bail->setRelation('parties', $bail->parties->filter(fn (LeaseParty $l): bool => $perimetre->keepsParty($l))->values());

            if ($complet) {
                $this->loadTerms($bail, $perimetre);
            }
        }

        return $this->vues->at(
            $groupe,
            fn (Lease $bail): CarbonImmutable => $portees[$bail->id]->day,
            fn (Lease $bail): ?CarbonImmutable => $complet ? $this->referenceDay($bail, $portees[$bail->id]) : null,
        );
    }

    private function loadTerms(Lease $bail, OwnerLeaseScope $perimetre): void
    {
        if ($perimetre->foreignUnits) {
            $bail->setRelation('terms', (new LeaseTerm)->newCollection());

            return;
        }

        $jour = $this->referenceDay($bail, $perimetre)->toDateString();
        $bail->load(['terms' => fn ($q) => $q
            ->where('valid_from', '<=', $jour)
            ->where(fn (Builder $e) => $e->whereNull('valid_to')->orWhere('valid_to', '>', $jour))
            ->orderBy('valid_from')->orderBy('id')]);
    }

    /**
     * Les conditions affichées sont celles du jour de référence, ramenées dans la vie du bail : début s'il n'a pas commencé, dernier jour s'il est fini.
     */
    private function referenceDay(Lease $bail, OwnerLeaseScope $perimetre): CarbonImmutable
    {
        $fin = $perimetre->end($bail);
        $jour = $perimetre->day->max(CarbonImmutable::parse($bail->starts_on->toDateString()));

        return $fin === null ? $jour : $jour->min(CarbonImmutable::parse($fin)->subDay());
    }
}
