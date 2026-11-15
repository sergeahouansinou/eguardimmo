<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use Illuminate\Support\Str;

final class FileNames
{
    public static function display(string $nom): string
    {
        $propre = trim((string) preg_replace('/[\x00-\x1F\x7F\/\\\\]/u', '', mb_scrub($nom, 'UTF-8')));

        return Str::limit($propre === '' ? 'document' : $propre, 250, '');
    }

    public static function archiveEntry(string $nom): string
    {
        $nom = mb_scrub($nom, 'UTF-8');
        $dernier = preg_split('/[\/\\\\]/', $nom);
        $base = is_array($dernier) ? (string) end($dernier) : $nom;
        $propre = trim(ltrim((string) preg_replace('/[\x00-\x1F\x7F:*?"<>|]/u', '', $base), '.'));

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
