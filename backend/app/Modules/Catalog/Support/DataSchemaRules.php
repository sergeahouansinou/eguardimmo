<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Support;

use Closure;

final class DataSchemaRules
{
    public const NOM_CHAMP = '/^[a-z][a-z0-9_]{0,62}$/';

    private const TYPES_AVEC_BORNES = ['string', 'integer', 'number'];

    private const TYPES_AVEC_ENUM = ['string', 'integer', 'number'];

    public static function required(): Closure
    {
        return function (string $attribut, mixed $valeur, Closure $echec): void {
            if (! is_bool($valeur)) {
                $echec('Le caractère obligatoire d\'un champ doit être un booléen (true ou false).');
            }
        };
    }

    public static function schema(): Closure
    {
        return function (string $attribut, mixed $valeur, Closure $echec): void {
            if (! is_array($valeur)) {
                return;
            }

            foreach ($valeur as $nom => $definition) {
                if (! is_string($nom) || preg_match(self::NOM_CHAMP, $nom) !== 1) {
                    $echec('Le nom d\'un champ doit suivre le format ^[a-z][a-z0-9_]{0,62}$.');

                    return;
                }

                if (is_array($definition) && ($message = self::incoherence($definition)) !== null) {
                    $echec("Champ « {$nom} » : {$message}");

                    return;
                }
            }
        };
    }

    /**
     * @param  array<array-key, mixed>  $definition
     */
    private static function incoherence(array $definition): ?string
    {
        $type = $definition['type'] ?? null;
        $aBornes = isset($definition['min']) || isset($definition['max']);

        if ($aBornes && ! in_array($type, self::TYPES_AVEC_BORNES, true)) {
            return 'min et max ne s\'appliquent qu\'aux types string, integer et number.';
        }

        if (isset($definition['enum']) && ! in_array($type, self::TYPES_AVEC_ENUM, true)) {
            return 'enum ne s\'applique qu\'aux types string, integer et number.';
        }

        if ($aBornes && isset($definition['enum'])) {
            return 'min et max sont incompatibles avec enum.';
        }

        $min = $definition['min'] ?? null;
        $max = $definition['max'] ?? null;

        if ($type === 'string') {
            foreach ([$min, $max] as $borne) {
                if ($borne !== null && (! is_numeric($borne) || (float) $borne < 0 || (float) $borne !== floor((float) $borne))) {
                    return 'min et max d\'un string sont des longueurs entières positives.';
                }
            }
        }

        if ($type === 'integer') {
            foreach ([$min, $max] as $borne) {
                if ($borne !== null && (! is_numeric($borne) || (float) $borne !== floor((float) $borne))) {
                    return 'min et max d\'un integer sont des entiers.';
                }
            }
        }

        if (is_numeric($min) && is_numeric($max) && (float) $min > (float) $max) {
            return 'min doit être inférieur ou égal à max.';
        }

        return null;
    }
}
