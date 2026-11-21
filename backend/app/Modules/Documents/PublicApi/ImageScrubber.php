<?php

declare(strict_types=1);

namespace App\Modules\Documents\PublicApi;

use App\Modules\Documents\Support\ImageSanitizer;

/**
 * Réencodage d'une image hors du stockage probant (pièces du support) : seuls les pixels sont conservés, sans EXIF ni position GPS.
 */
final readonly class ImageScrubber
{
    public function applies(string $type): bool
    {
        return ImageSanitizer::applies($type);
    }

    /**
     * Refuse une image illisible ou trop grande (problème RFC 9457 `file_unsafe`).
     *
     * @return string chemin d'un fichier temporaire que l'appelant supprime
     */
    public function clean(string $chemin, string $type): string
    {
        return ImageSanitizer::clean($chemin, $type);
    }
}
