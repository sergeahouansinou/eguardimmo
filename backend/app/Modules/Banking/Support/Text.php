<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use Illuminate\Support\Str;

final class Text
{
    public static function clean(?string $valeur, int $max): ?string
    {
        if ($valeur === null) {
            return null;
        }

        $propre = preg_replace('/[\p{Cc}\p{Cf}\s]+/u', ' ', $valeur);
        $propre = trim($propre ?? '');

        return $propre === '' ? null : mb_substr($propre, 0, $max);
    }

    public static function fold(string $valeur): string
    {
        $replie = preg_replace('/[^a-z0-9]+/', ' ', strtolower(Str::ascii($valeur)));

        return trim($replie ?? '');
    }

    /**
     * @return list<string>
     */
    public static function words(string $valeur, int $minLength = 3): array
    {
        $mots = preg_split('/\s+/', self::fold($valeur), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_values(array_filter($mots, static fn (string $mot): bool => strlen($mot) >= $minLength));
    }
}
