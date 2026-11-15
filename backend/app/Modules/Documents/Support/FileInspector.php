<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Enums\FileCategory;
use finfo;

final class FileInspector
{
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
     */
    private static function containsPhp(string $chemin): bool
    {
        $contenu = (string) file_get_contents($chemin);

        return preg_match('/<\?(php|=)/i', $contenu) === 1;
    }
}
