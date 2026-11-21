<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Lots couverts d'un mandant pour l'accueil : état d'occupation, nom du locataire (jamais ses coordonnées), loyer contractuel du jour
 * et retard. Suppose le contexte de l'organisation des lots.
 */
final readonly class OwnerHomeUnits
{
    public function __construct(
        private UnitDirectory $lots,
        private LeaseDirectory $baux,
        private LeaseParticipants $participants,
        private LeaseSchedule $echeancier,
        private PartyDirectory $parties,
        private OwnerArrears $impayes,
    ) {}

    /**
     * @param  list<string>  $unitIds
     * @param  array<string, int>  $encaisse  encaissé du mois par lot
     * @return array{units: list<array<string, mixed>>, occupied: int, arrears: array{amount: int, count: int, max_days_late: int}}
     */
    public function of(array $unitIds, array $encaisse, Currency $devise, CarbonImmutable $jour): array
    {
        $lots = $this->lots->findMany($unitIds);
        $occupations = [];

        foreach ($this->baux->occupancyAt($unitIds, $jour) as $occupation) {
            if (! isset($occupations[$occupation->unitId]) || $occupation->isMain) {
                $occupations[$occupation->unitId] = ['lease' => $occupation->leaseId, 'main' => $occupation->isMain];
            }
        }

        $baux = array_values(array_unique(array_map(fn (array $o): string => $o['lease'], $occupations)));
        $noms = $this->locataires($baux, $jour);
        $loyers = $this->loyers($baux, $jour);
        $retards = $this->impayes->byLease($baux, $devise, $jour);
        $lignes = [];

        foreach ($unitIds as $id) {
            if (! isset($lots[$id])) {
                continue;
            }

            $lot = $lots[$id];
            $occupation = $occupations[$id] ?? null;
            $bail = $occupation['lease'] ?? null;
            $principal = $occupation !== null && $occupation['main'];

            $lignes[] = [
                'id' => $lot->id,
                'reference' => $lot->reference,
                'property_name' => $lot->propertyName,
                'label' => $lot->propertyName.' - '.$lot->reference,
                'type' => $lot->unitTypeKey,
                'surface_hundredths' => $lot->surfaceHundredths,
                'state' => $bail === null ? 'vacant' : (isset($retards[$bail]) && $principal ? 'late' : 'occupied'),
                'tenant' => $bail !== null && isset($noms[$bail]) ? ['name' => $noms[$bail]] : null,
                'rent' => $principal ? ($loyers[$bail] ?? 0) : null,
                'collected' => $encaisse[$id] ?? 0,
            ];
        }

        usort($lignes, fn (array $a, array $b): int => strcmp((string) $a['label'], (string) $b['label']));

        return ['units' => $lignes, 'occupied' => count($occupations), 'arrears' => [
            'amount' => array_sum(array_column($retards, 'amount')),
            'count' => array_sum(array_column($retards, 'count')),
            'max_days_late' => $retards === [] ? 0 : max(array_column($retards, 'days')),
        ]];
    }

    /**
     * @param  list<string>  $baux
     * @return array<string, string> noms des locataires du jour, par bail
     */
    private function locataires(array $baux, CarbonImmutable $jour): array
    {
        $parBail = $this->participants->tenantsAtMany($baux, $jour);
        $parties = [];

        foreach ($parBail as $lignes) {
            foreach ($lignes as $ligne) {
                $parties[$ligne->partyId] = $ligne->partyId;
            }
        }

        $fiches = $this->parties->findMany(array_values($parties));
        $noms = [];

        foreach ($parBail as $bail => $lignes) {
            $liste = array_values(array_filter(array_map(fn ($l): ?string => isset($fiches[$l->partyId]) && ! $fiches[$l->partyId]->isAnonymized ? $fiches[$l->partyId]->displayName : null, $lignes)));

            if ($liste !== []) {
                $noms[$bail] = implode(', ', $liste);
            }
        }

        return $noms;
    }

    /**
     * @param  list<string>  $baux
     * @return array<string, int> loyer contractuel du jour (hors charges), par bail
     */
    private function loyers(array $baux, CarbonImmutable $jour): array
    {
        $loyers = [];

        foreach ($this->echeancier->linesBetweenMany($baux, $jour, $jour) as $bail => $lignes) {
            $loyers[$bail] = 0;

            foreach ($lignes as $ligne) {
                if ($ligne->semantic === LeaseComponentSemantic::Rent) {
                    $loyers[$bail] += (int) $ligne->amount->getAmount();
                }
            }
        }

        return $loyers;
    }
}
