<?php

declare(strict_types=1);

namespace App\Modules\Listings\Support;

/**
 * Référence publique opaque : tirée au hasard, sans lien avec l'identifiant ni l'ordre de création.
 */
final class PublicRef
{
    public const int LENGTH = 12;

    private const string ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

    public static function generate(): string
    {
        $reference = '';

        for ($i = 0; $i < self::LENGTH; $i++) {
            $reference .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
        }

        return $reference;
    }

    public static function isValid(string $valeur): bool
    {
        return preg_match('/^[a-z2-9]{12}$/D', $valeur) === 1;
    }
}
