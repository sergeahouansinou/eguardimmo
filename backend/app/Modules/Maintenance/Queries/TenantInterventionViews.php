<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionEvent;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Models\InterventionVisit;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Lectures du locataire sous le contexte de l'organisation de chaque intervention, en nombre de requêtes constant par
 * organisation (jamais une requête par ligne).
 */
final readonly class TenantInterventionViews
{
    public function __construct(
        private CurrentOrganization $contexte,
        private TermDirectory $termes,
        private UnitDirectory $lots,
    ) {}

    /**
     * @param  iterable<Intervention>  $interventions
     * @return array<string, TenantView> par identifiant d'intervention
     */
    public function build(iterable $interventions, bool $detail): array
    {
        $parOrganisation = [];

        foreach ($interventions as $intervention) {
            $parOrganisation[$intervention->organization_id][] = $intervention;
        }

        $vues = [];

        foreach ($parOrganisation as $organisation => $groupe) {
            $vues += $this->contexte->run($organisation, fn (): array => $this->forOrganization($groupe, $detail));
        }

        return $vues;
    }

    /**
     * @param  list<Intervention>  $groupe
     * @return array<string, TenantView>
     */
    private function forOrganization(array $groupe, bool $detail): array
    {
        $ids = array_map(fn (Intervention $i): string => $i->id, $groupe);
        $natures = $this->termes->findMany(array_values(array_unique(array_map(fn (Intervention $i): string => $i->nature_term_id, $groupe))), VocabularyKey::InterventionNature);
        $lotIds = array_values(array_unique(array_filter(array_map(fn (Intervention $i): ?string => $i->unit_id, $groupe))));
        $lots = $lotIds === [] ? [] : $this->lots->findMany($lotIds);

        $visites = InterventionVisit::query()->whereIn('intervention_id', $ids)->where('status', '<>', VisitStatus::Cancelled->value)->orderBy('scheduled_on')->orderBy('id')->get()->groupBy('intervention_id');
        $evenements = $detail ? InterventionEvent::query()->whereIn('intervention_id', $ids)->where('visible_to_tenant', true)->orderBy('created_at')->orderBy('id')->get()->groupBy('intervention_id') : collect();
        $fichiers = $detail ? InterventionFile::query()->whereIn('intervention_id', $ids)->where('visible_to_tenant', true)->orderBy('created_at')->orderBy('id')->get()->groupBy('intervention_id') : collect();

        $vues = [];

        foreach ($groupe as $intervention) {
            $lot = $intervention->unit_id === null ? null : ($lots[$intervention->unit_id] ?? null);
            $nature = $natures[$intervention->nature_term_id] ?? null;
            $vues[$intervention->id] = new TenantView(
                $nature?->key,
                $nature === null ? null : (string) ($nature->labels['fr'] ?? $nature->key),
                $lot === null ? 'Parties communes' : $lot->propertyName.' - '.$lot->reference,
                array_values(($visites[$intervention->id] ?? collect())->all()),
                array_values(($evenements[$intervention->id] ?? collect())->all()),
                array_values(($fichiers[$intervention->id] ?? collect())->all()),
            );
        }

        return $vues;
    }
}
