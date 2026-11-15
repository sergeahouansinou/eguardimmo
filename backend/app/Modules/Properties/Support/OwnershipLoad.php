<?php

declare(strict_types=1);

namespace App\Modules\Properties\Support;

/**
 * Somme maximale des quotes-parts (points de base) en vigueur au même instant, périodes semi-ouvertes [from, to).
 * Seules les dates de début des lignes sont des points d'évaluation : la somme ne croît qu'à un début.
 */
final class OwnershipLoad
{
    public const CAP = 10000;

    /**
     * @param  list<array{from: string, to: string|null, share: int}>  $lignes  dates au format Y-m-d
     * @param  string|null  $depuis  limite l'évaluation à la fenêtre [depuis, jusqua)
     */
    public static function peak(array $lignes, ?string $depuis = null, ?string $jusqua = null): int
    {
        $points = array_map(fn (array $ligne): string => $ligne['from'], $lignes);

        if ($depuis !== null) {
            $points = array_values(array_filter(
                $points,
                fn (string $date): bool => $date > $depuis && ($jusqua === null || $date < $jusqua),
            ));
            $points[] = $depuis;
        }

        $pic = 0;

        foreach (array_unique($points) as $instant) {
            $somme = 0;

            foreach ($lignes as $ligne) {
                if ($ligne['from'] <= $instant && ($ligne['to'] === null || $ligne['to'] > $instant)) {
                    $somme += $ligne['share'];
                }
            }

            $pic = max($pic, $somme);
        }

        return $pic;
    }
}
