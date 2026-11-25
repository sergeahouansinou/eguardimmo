<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use Illuminate\Support\Str;

final class FileNames
{
    private const CARACTERES_BIDI = '/[\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u';

    public static function display(string $nom): string
    {
        $propre = trim((string) preg_replace(self::CARACTERES_BIDI, '', (string) preg_replace('/[\x00-\x1F\x7F\/\\\\]/u', '', mb_scrub($nom, 'UTF-8'))));

        return Str::limit($propre === '' ? 'document' : $propre, 250, '');
    }

    /**
     * Nom affiché dont l'extension suit le type détecté : un PDF envoyé sous le nom `x.html` ressort `x.pdf`.
     *
     * @param  list<string>  $extensions  extensions admises pour le type détecté, la première sert au remplacement
     */
    public static function aligned(string $nom, array $extensions): string
    {
        $propre = self::display($nom);
        $originale = pathinfo($propre, PATHINFO_EXTENSION);

        if (in_array(mb_strtolower($originale), $extensions, true)) {
            return $propre;
        }

        $racine = $originale === '' || str_ends_with($propre, '.') ? rtrim($propre, '.') : substr($propre, 0, -(strlen($originale) + 1));

        return Str::limit($racine === '' ? 'document' : $racine, 250 - strlen($extensions[0]) - 1, '').'.'.$extensions[0];
    }

    public static function archiveEntry(string $nom): string
    {
        $nom = mb_scrub($nom, 'UTF-8');
        $dernier = preg_split('/[\/\\\\]/', $nom);
        $base = is_array($dernier) ? (string) end($dernier) : $nom;
        $propre = trim(ltrim((string) preg_replace(self::CARACTERES_BIDI, '', (string) preg_replace('/[\x00-\x1F\x7F:*?"<>|]/u', '', $base)), '.'));

        return Str::limit($propre === '' ? 'fichier' : $propre, 200, '');
    }

    /**
     * @param  array<string, true>  $pris
     */
    public static function unique(string $nom, array &$pris): string
    {
        $candidat = $nom;
        $extension = pathinfo($nom, PATHINFO_EXTENSION);
        $racine = $extension === '' ? $nom : substr($nom, 0, -(strlen($extension) + 1));

        for ($n = 2; isset($pris[mb_strtolower($candidat)]); $n++) {
            $candidat = $racine." ({$n})".($extension === '' ? '' : ".{$extension}");
        }

        $pris[mb_strtolower($candidat)] = true;

        return $candidat;
    }
}
