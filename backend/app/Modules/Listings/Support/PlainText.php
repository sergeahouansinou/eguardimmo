<?php

declare(strict_types=1);

namespace App\Modules\Listings\Support;

/**
 * Le contenu d'une annonce est du texte brut : toute balise est refusée plutôt que « nettoyée », de même que les caractères de contrôle et de
 * format (retour chariot, NUL, séquence d'échappement, texte bidirectionnel, espace de largeur nulle) qui falsifient l'affichage. Seul le saut
 * de ligne \n est admis dans un texte de plusieurs lignes.
 */
final class PlainText
{
    private const string LIGNE = '/[<>]|[\p{Cc}\p{Cf}]/u';

    private const string TEXTE = '/[<>]|[^\P{Cc}\n]|\p{Cf}/u';

    /**
     * @return list<string>
     */
    public static function line(int $max, bool $obligatoire = false): array
    {
        return [$obligatoire ? 'required' : 'nullable', 'string', 'max:'.$max, 'not_regex:'.self::LIGNE];
    }

    /**
     * @return list<string>
     */
    public static function text(int $max, bool $obligatoire = false): array
    {
        return [$obligatoire ? 'required' : 'nullable', 'string', 'max:'.$max, 'not_regex:'.self::TEXTE];
    }
}
