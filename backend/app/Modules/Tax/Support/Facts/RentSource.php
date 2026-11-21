<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support\Facts;

use App\Modules\Accounting\Data\ComponentCollectionData;
use App\Modules\Accounting\Enums\CollectionComponent;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Tax\Data\FactEntryData;
use Money\Currency;

/**
 * Ligne 211 : loyers encaissés dans l'année, avances au jour de leur réception (nouvelle agrégation d'Accounting). Une part non
 * résolue ou le loyer d'un bail hors location nue ne se range jamais d'office dans la ligne.
 */
final readonly class RentSource
{
    public function __construct(private LedgerAggregates $grandLivre) {}

    /**
     * @return list<ComponentCollectionData>
     */
    public function collect(YearWindow $annee, Currency $devise): array
    {
        return $this->grandLivre->collectedByComponent($devise, $annee->from, $annee->last);
    }

    /**
     * @param  list<ComponentCollectionData>  $lignes
     * @return array{entries: list<FactEntryData>, warnings: list<array{code: string, property_id: ?string, amount?: int, detail?: string}>}
     */
    public function classify(array $lignes, LeaseUniverse $baux): array
    {
        $parMois = [];
        $avertissements = [];

        foreach ($lignes as $l) {
            $montant = (int) $l->amount->getAmount();

            if ($l->component === CollectionComponent::Unresolved) {
                $avertissements[] = ['code' => 'unresolved_collection', 'property_id' => $l->leaseId === null ? null : $baux->propertyOf($l->leaseId, $l->unitId), 'amount' => $montant];

                continue;
            }

            if (! in_array($l->component, [CollectionComponent::Rent, CollectionComponent::Advance], true)) {
                continue;
            }

            if ($l->leaseId === null || isset($baux->excluded[$l->leaseId])) {
                $avertissements[] = ['code' => 'excluded_regime', 'property_id' => null, 'amount' => $montant];

                continue;
            }

            $bien = $baux->propertyOf($l->leaseId, $l->unitId);

            if ($bien === null) {
                $avertissements[] = ['code' => 'unresolved_collection', 'property_id' => null, 'amount' => $montant];

                continue;
            }

            $genre = $l->component === CollectionComponent::Advance ? FactEntryData::ADVANCE : FactEntryData::RENT;
            $cle = "{$bien}|{$genre}|{$l->month}";
            $parMois[$cle] = [$bien, $genre, $l->month, ($parMois[$cle][3] ?? 0) + $montant];
        }

        ksort($parMois);

        return [
            'entries' => array_values(array_map(fn (array $m): FactEntryData => new FactEntryData($m[0], '211', $m[3], $m[1], $m[2]), $parMois)),
            'warnings' => $avertissements,
        ];
    }
}
