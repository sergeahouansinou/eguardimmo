<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Support\InstallmentView;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * Résout des pièces déjà jugées visibles (TenantInstallments, TenantPayments). Chaque organisation se lit dans son propre
 * contexte : le nombre de requêtes croît avec le nombre d'organisations, jamais avec celui des pièces.
 */
final readonly class TenantRentViews
{
    public function __construct(
        private CurrentOrganization $contexte,
        private InstallmentViews $echeances,
        private LeaseDirectory $baux,
    ) {}

    /**
     * Charge avis, quittance valable et, au détail, les lignes ; lit les restes dus au grand livre.
     *
     * @param  list<Installment>  $items
     */
    public function installments(array $items, CarbonImmutable $today, bool $detail): InstallmentView
    {
        $restes = [];
        $baux = [];
        $etats = [];

        foreach ($this->parOrganisation($items) as $organisationId => $groupe) {
            $vue = $this->contexte->run($organisationId, function () use ($groupe, $today, $detail): InstallmentView {
                (new Installment)->newCollection($groupe)->load($detail ? ['lines', 'notice', 'receipt'] : ['notice', 'receipt']);

                return $this->echeances->of($groupe, $today);
            });
            $restes += $vue->outstanding;
            $baux += $vue->leases;
            $etats += $vue->receiptStates;
        }

        return new InstallmentView($restes, $baux, $etats, $today);
    }

    /**
     * Charge les imputations non annulées et lit la référence des baux.
     *
     * @param  list<Payment>  $items
     * @return array<string, string> référence du bail par identifiant de bail
     */
    public function payments(array $items): array
    {
        $references = [];

        foreach ($this->parOrganisation($items) as $organisationId => $groupe) {
            $this->contexte->run($organisationId, function () use ($groupe, &$references): void {
                (new Payment)->newCollection($groupe)->load(['allocations' => fn ($q) => $q->whereNull('reversed_at')]);

                foreach ($this->baux->findMany(array_values(array_unique(array_map(fn (Payment $p): string => $p->lease_id, $groupe)))) as $bail) {
                    $references[$bail->id] = $bail->reference;
                }
            });
        }

        return $references;
    }

    /**
     * @template TModel of Model
     *
     * @param  list<TModel>  $items
     * @return array<string, list<TModel>>
     */
    private function parOrganisation(array $items): array
    {
        $groupes = [];

        foreach ($items as $item) {
            $groupes[(string) $item->getAttribute('organization_id')][] = $item;
        }

        return $groupes;
    }
}
