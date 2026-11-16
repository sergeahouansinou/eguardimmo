<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

final class AccountNameSplitter
{
    private const LONGUEUR_NOM_MAX = 60;

    /**
     * Le premier mot est le prénom, le reste le nom ; un mot seul sert de prénom et de nom.
     *
     * @return array{string, string}
     */
    public static function split(string $nomDeCompte): array
    {
        $mots = preg_split('/\s+/u', trim($nomDeCompte), 2, PREG_SPLIT_NO_EMPTY);
        $prenom = $mots[0] ?? '';
        $nom = $mots[1] ?? $prenom;

        return [mb_substr($prenom, 0, self::LONGUEUR_NOM_MAX), mb_substr($nom, 0, self::LONGUEUR_NOM_MAX)];
    }
}
