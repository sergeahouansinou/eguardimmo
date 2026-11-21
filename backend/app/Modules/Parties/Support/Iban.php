<?php

declare(strict_types=1);

namespace App\Modules\Parties\Support;

final class Iban
{
    public static function normalize(#[\SensitiveParameter] string $iban): string
    {
        return strtoupper((string) preg_replace('/[\s-]+/', '', $iban));
    }

    public static function isValid(#[\SensitiveParameter] string $iban): bool
    {
        $iban = self::normalize($iban);

        if (preg_match('/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/D', $iban) !== 1) {
            return false;
        }

        $numerique = '';

        foreach (str_split(substr($iban, 4).substr($iban, 0, 4)) as $caractere) {
            $numerique .= ctype_digit($caractere) ? $caractere : (string) (ord($caractere) - 55);
        }

        $reste = 0;

        foreach (str_split($numerique, 7) as $bloc) {
            $reste = (int) ($reste.$bloc) % 97;
        }

        return $reste === 1;
    }

    public static function last4(#[\SensitiveParameter] string $iban): string
    {
        return substr(self::normalize($iban), -4);
    }
}
