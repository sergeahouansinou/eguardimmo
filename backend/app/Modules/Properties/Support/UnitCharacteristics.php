<?php

declare(strict_types=1);

namespace App\Modules\Properties\Support;

use App\Modules\Catalog\Enums\UnitTypeSemantic;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Schéma minimal des caractéristiques d'un lot, par sens système du type de lot (ADR 0020).
 * Ce que le calcul utilise (surface, étage) reste en colonne ; aucune règle métier ne lit ces valeurs.
 */
final class UnitCharacteristics
{
    private const BOOLEEN = ['type' => 'boolean'];

    /**
     * @return array<string, array{type: string, min?: int, max?: int}>
     */
    public static function schema(?UnitTypeSemantic $sens): array
    {
        return match ($sens) {
            UnitTypeSemantic::Residential => [
                'rooms' => ['type' => 'integer', 'min' => 0, 'max' => 100],
                'bedrooms' => ['type' => 'integer', 'min' => 0, 'max' => 100],
                'bathrooms' => ['type' => 'integer', 'min' => 0, 'max' => 50],
                'construction_year' => ['type' => 'integer', 'min' => 1000, 'max' => 2200],
                'has_elevator' => self::BOOLEEN,
                'has_balcony' => self::BOOLEEN,
            ],
            UnitTypeSemantic::Parking => [
                'spot_number' => ['type' => 'string', 'max' => 20],
                'covered' => self::BOOLEEN,
                'has_charging_point' => self::BOOLEEN,
            ],
            UnitTypeSemantic::Commercial => [
                'has_storefront' => self::BOOLEEN,
                'accessible_reduced_mobility' => self::BOOLEEN,
            ],
            UnitTypeSemantic::Storage => [
                'lockable' => self::BOOLEEN,
            ],
            UnitTypeSemantic::Land => [
                'fenced' => self::BOOLEEN,
                'buildable' => self::BOOLEEN,
            ],
            null => [],
        };
    }

    /**
     * Refuse toute clé hors schéma ; une valeur nulle retire la caractéristique.
     *
     * @param  array<string, mixed>  $valeurs
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public static function validate(?UnitTypeSemantic $sens, array $valeurs): array
    {
        $schema = self::schema($sens);
        $valeurs = array_filter($valeurs, fn (mixed $valeur): bool => $valeur !== null);
        $regles = [];

        foreach ($schema as $cle => $definition) {
            $regles["characteristics.{$cle}"] = self::rules($definition);
        }

        $validateur = Validator::make(['characteristics' => $valeurs], $regles);
        $validateur->after(function ($validateur) use ($valeurs, $schema): void {
            foreach (array_keys(array_diff_key($valeurs, $schema)) as $cle) {
                $validateur->errors()->add("characteristics.{$cle}", 'Cette caractéristique n\'existe pas pour ce type de lot.');
            }
        });

        $validateur->validate();

        $resultat = [];

        foreach ($valeurs as $cle => $valeur) {
            $resultat[$cle] = self::cast($schema[$cle]['type'], $valeur);
        }

        return $resultat;
    }

    /**
     * @param  array{type: string, min?: int, max?: int}  $definition
     * @return list<string>
     */
    private static function rules(array $definition): array
    {
        $regles = [$definition['type']];

        if ($definition['type'] === 'string') {
            $regles[] = 'max:'.($definition['max'] ?? 100);
        } elseif ($definition['type'] === 'integer') {
            $regles[] = 'min:'.($definition['min'] ?? 0);
            $regles[] = 'max:'.($definition['max'] ?? 1000000);
        }

        return $regles;
    }

    private static function cast(string $type, mixed $valeur): mixed
    {
        return match ($type) {
            'integer' => (int) $valeur,
            'boolean' => filter_var($valeur, FILTER_VALIDATE_BOOLEAN),
            default => (string) $valeur,
        };
    }
}
