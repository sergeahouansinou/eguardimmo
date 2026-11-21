<?php

declare(strict_types=1);

namespace App\Shared\Mail;

/**
 * Une donnée saisie par un tiers (nom d'organisation) ne doit pas devenir du Markdown ni du HTML dans un message envoyé
 * sous le nom de la plateforme.
 */
final class MailText
{
    /**
     * Pour un objet de message : sans caractère de contrôle, de formatage (inversion du sens d'écriture) ni saut de ligne.
     */
    public static function plain(string $texte): string
    {
        $net = preg_replace('/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/u', ' ', $texte) ?? '';

        return trim((string) preg_replace('/\s{2,}/u', ' ', $net));
    }

    /**
     * Pour un corps de message rendu en Markdown : les caractères qui ouvrent un lien, une image, un lien automatique,
     * une emphase ou du code sont précédés d'une barre oblique inverse.
     */
    public static function markdown(string $texte): string
    {
        return (string) preg_replace('/([\\\\`*_\[\]()<>])/', '\\\\$1', self::plain($texte));
    }
}
