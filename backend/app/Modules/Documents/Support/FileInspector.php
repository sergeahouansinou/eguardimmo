<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Enums\FileCategory;
use finfo;

final class FileInspector
{
    private const TAILLE_BLOC = 65536;

    private const CHEVAUCHEMENT = 4;

    /**
     * Le type vient du contenu, jamais du nom ni de l'en-tête du client.
     */
    public static function detectedType(string $chemin): ?string
    {
        $type = (new finfo(FILEINFO_MIME_TYPE))->file($chemin);

        return is_string($type) ? $type : null;
    }

    public static function problem(string $chemin, FileCategory $categorie): ?ErrorCode
    {
        $type = self::detectedType($chemin);

        if ($type === null || ! array_key_exists($type, $categorie->allowedTypes())) {
            return ErrorCode::FileTypeRefused;
        }

        if ((int) filesize($chemin) > $categorie->maxBytes()) {
            return ErrorCode::FileTooLarge;
        }

        if ($categorie !== FileCategory::Bundle && self::containsPhp($chemin)) {
            return ErrorCode::FileUnsafe;
        }

        return null;
    }

    /**
     * Refuse un polyglotte (en-tête PDF ou image suivi de code PHP), que `finfo` ne distingue pas d'un vrai fichier.
     * Lecture en flux : la fin de chaque bloc est reportée sur le suivant pour attraper une balise à cheval.
     */
    private static function containsPhp(string $chemin): bool
    {
        $flux = fopen($chemin, 'rb');

        if ($flux === false) {
            return true;
        }

        try {
            $reste = '';

            while (! feof($flux)) {
                $bloc = fread($flux, self::TAILLE_BLOC);

                if ($bloc === false) {
                    return true;
                }

                $zone = $reste.$bloc;

                if (preg_match('/<\?(php|=)/i', $zone) === 1) {
                    return true;
                }

                $reste = substr($zone, -self::CHEVAUCHEMENT);
            }
        } finally {
            fclose($flux);
        }

        return false;
    }
}
