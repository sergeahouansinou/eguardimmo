<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

use Illuminate\Support\Str;

final class TenantInvitationToken
{
    public const int VALIDITE_JOURS = 7;

    public const int LONGUEUR = 48;

    public static function generate(): string
    {
        return Str::random(self::LONGUEUR);
    }

    public static function hash(#[\SensitiveParameter] string $jeton): string
    {
        return hash('sha256', $jeton);
    }

    public static function url(#[\SensitiveParameter] string $jeton): string
    {
        return Hub::url('/invitation-locataire/'.$jeton);
    }

    public static function ownerUrl(#[\SensitiveParameter] string $jeton): string
    {
        return Hub::url('/invitation-proprietaire/'.$jeton);
    }

    /**
     * Indice affiché à l'organisation : assez pour reconnaître l'adresse, pas pour la reconstituer.
     */
    public static function hint(string $email): string
    {
        [$local, $domaine] = array_pad(explode('@', $email, 2), 2, '');

        return mb_substr($local, 0, 1).'***@'.$domaine;
    }
}
