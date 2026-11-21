<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Support\MandateView;
use App\Modules\Mandates\Support\OwnerMandateView;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Résout des mandats déjà jugés visibles, une organisation après l'autre : le nombre de requêtes croît avec les agences, pas les mandats.
 */
final readonly class OwnerMandateViews
{
    public function __construct(
        private MandateViews $vues,
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
        private MandateEndRequests $demandesFin,
    ) {}

    /**
     * @param  iterable<Mandate>  $mandats
     * @return list<OwnerMandateView> dans l'ordre reçu
     */
    public function of(OwnerScopeData $portee, iterable $mandats): array
    {
        $mandats = array_values([...$mandats]);
        $noms = $this->organisations->names(array_values(array_unique(array_map(fn (Mandate $m): string => $m->organization_id, $mandats))));
        $demandes = $this->demandesFin->pendingAmong(array_map(fn (Mandate $m): string => $m->id, $mandats));
        $parOrganisation = [];

        foreach ($mandats as $mandat) {
            $parOrganisation[$mandat->organization_id][] = $mandat;
        }

        $vues = [];

        foreach ($parOrganisation as $organisationId => $groupe) {
            $this->contexte->run($organisationId, function () use ($groupe, &$vues): void {
                foreach ($this->vues->of((new Mandate)->newCollection($groupe)->load(['units', 'terms'])) as $vue) {
                    $vues[$vue->mandate->id] = $vue;
                }
            });
        }

        return array_values(array_filter(array_map(function (Mandate $mandat) use ($vues, $noms, $portee, $demandes): ?OwnerMandateView {
            $visible = $portee->visible($mandat->organization_id, $mandat->mandant_party_id);
            $vue = $vues[$mandat->id] ?? null;

            return $visible === null || ! $vue instanceof MandateView ? null : new OwnerMandateView($vue, $noms[$mandat->organization_id] ?? null, $visible, $demandes[$mandat->id] ?? null);
        }, $mandats)));
    }
}
