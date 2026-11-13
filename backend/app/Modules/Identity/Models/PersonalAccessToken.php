<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

final class PersonalAccessToken extends SanctumPersonalAccessToken
{
    use HasUuids;

    /**
     * @param  string  $token
     */
    public static function findToken($token): ?static
    {
        $identifiant = Str::before($token, '|');

        // Sur PostgreSQL, comparer une colonne uuid à « abc » lève une erreur SQL : un jeton forgé ferait un 500.
        if (str_contains($token, '|') && ! Str::isUuid($identifiant)) {
            return null;
        }

        $trouve = parent::findToken($token);

        return $trouve instanceof self ? $trouve : null;
    }
}
