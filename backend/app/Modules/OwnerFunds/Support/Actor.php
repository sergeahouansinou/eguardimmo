<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;

final class Actor
{
    public static function id(Request $requete): string
    {
        $utilisateur = $requete->user() ?? throw new AuthenticationException;

        return (string) $utilisateur->getKey();
    }
}
