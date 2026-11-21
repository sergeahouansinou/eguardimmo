<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

/**
 * Libellés de répartition d'un décompte (« Tantièmes 64/1 000 », « Surface 64,2 m² »), construits en entiers.
 */
final class SplitLabels
{
    public static function label(string $genre, int $poids, int $denominateur): string
    {
        return match ($genre) {
            'tantiemes' => 'Tantièmes '.self::integer($poids).'/'.self::integer($denominateur),
            'surface' => 'Surface '.self::hundredths($poids).' m²',
            'equal' => 'Part égale '.self::integer($poids).'/'.self::integer($denominateur),
            'custom' => 'Clé personnalisée '.self::integer($poids).'/'.self::integer($denominateur),
            'consumption' => 'Consommation',
            default => 'Poste du lot',
        };
    }

    private static function integer(int $valeur): string
    {
        return number_format($valeur, 0, '', ' ');
    }

    private static function hundredths(int $centiemes): string
    {
        $reste = $centiemes % 100;
        $entier = self::integer(intdiv($centiemes, 100));

        return $reste === 0 ? $entier : $entier.','.rtrim(str_pad((string) $reste, 2, '0', STR_PAD_LEFT), '0');
    }
}
