<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

/**
 * Formes sous lesquelles un même numéro peut être saisi : E.164 et national, selon le pays de l'organisation.
 */
final class PhoneVariants
{
    private const INDICATIFS = ['FR' => ['33', true], 'BE' => ['32', true], 'LU' => ['352', false], 'CA' => ['1', false]];

    /**
     * @return list<string> toujours la valeur normalisée en premier
     */
    public static function of(string $normalise, string $pays): array
    {
        $formes = [$normalise];
        [$indicatif, $zeroDeTete] = self::INDICATIFS[$pays] ?? [null, false];

        if (str_starts_with($normalise, '00')) {
            $formes[] = '+'.substr($normalise, 2);
        }

        if ($indicatif !== null) {
            $formes = [...$formes, ...self::national($normalise, $indicatif, $zeroDeTete)];
        }

        return array_values(array_unique($formes));
    }

    /**
     * @return list<string>
     */
    private static function national(string $numero, string $indicatif, bool $zeroDeTete): array
    {
        $prefixe = '+'.$indicatif;

        if (str_starts_with($numero, $prefixe)) {
            $reste = substr($numero, strlen($prefixe));

            return [$zeroDeTete ? '0'.$reste : $reste];
        }

        if ($zeroDeTete && str_starts_with($numero, '0') && ! str_starts_with($numero, '00')) {
            return [$prefixe.substr($numero, 1)];
        }

        if (! $zeroDeTete && ! str_starts_with($numero, '+') && ! str_starts_with($numero, '00')) {
            return [$prefixe.$numero];
        }

        return [];
    }
}
