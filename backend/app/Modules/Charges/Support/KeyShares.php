<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\KeyKind;
use App\Modules\Properties\Data\UnitData;

/**
 * Poids d'une version de clé : `surface` copie la surface des lots, `equal` vaut 1 par lot non archivé, `tantiemes` et `custom` viennent de l'équipe.
 */
final class KeyShares
{
    /**
     * @param  list<UnitData>  $lots
     * @param  list<array{unit_id: string, weight: int}>  $saisis
     * @return array<string, int> poids par lot
     */
    public function resolve(KeyKind $genre, array $lots, array $saisis): array
    {
        return match ($genre) {
            KeyKind::Surface => $this->surfaces($lots),
            KeyKind::Equal => $this->equal($lots),
            KeyKind::Consumption => $saisis === [] ? [] : throw ErrorCode::KeyInvalid->problem('Une clé de consommation n\'a pas de poids : la quantité se saisit sur le poste de l\'exercice.'),
            KeyKind::Tantiemes, KeyKind::Custom => $this->typed($lots, $saisis),
        };
    }

    /**
     * @param  list<UnitData>  $lots
     * @return array<string, int>
     */
    private function surfaces(array $lots): array
    {
        $poids = [];

        foreach ($lots as $lot) {
            if ($lot->surfaceHundredths !== null && $lot->surfaceHundredths > 0) {
                $poids[$lot->id] = $lot->surfaceHundredths;
            }
        }

        return $poids === [] ? throw ErrorCode::KeyInvalid->problem('Aucun lot de ce bien n\'a de surface renseignée.') : $poids;
    }

    /**
     * @param  list<UnitData>  $lots
     * @return array<string, int>
     */
    private function equal(array $lots): array
    {
        $poids = [];

        foreach ($lots as $lot) {
            if (! $lot->isArchived) {
                $poids[$lot->id] = 1;
            }
        }

        return $poids === [] ? throw ErrorCode::KeyInvalid->problem('Ce bien n\'a aucun lot actif.') : $poids;
    }

    /**
     * @param  list<UnitData>  $lots
     * @param  list<array{unit_id: string, weight: int}>  $saisis
     * @return array<string, int>
     */
    private function typed(array $lots, array $saisis): array
    {
        $connus = array_flip(array_map(fn (UnitData $l): string => $l->id, $lots));
        $poids = [];

        foreach ($saisis as $ligne) {
            if (! isset($connus[$ligne['unit_id']]) || isset($poids[$ligne['unit_id']]) || $ligne['weight'] < 0) {
                throw ErrorCode::KeyInvalid->problem('Chaque lot du bien figure au plus une fois, avec un poids positif ou nul.');
            }

            $poids[$ligne['unit_id']] = $ligne['weight'];
        }

        return array_sum($poids) > 0 ? $poids : throw ErrorCode::KeyInvalid->problem('Au moins un lot doit avoir un poids supérieur à zéro.');
    }
}
