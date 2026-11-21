<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Enums\ErrorCode;

/**
 * Réencode une image pour en retirer toutes les métadonnées (EXIF, position GPS) : seuls les pixels sont conservés (ADR 0029).
 */
final class ImageSanitizer
{
    private const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    public static function applies(string $type): bool
    {
        return in_array($type, self::TYPES, true);
    }

    /**
     * @return string chemin d'un fichier temporaire que l'appelant supprime
     */
    public static function clean(string $chemin, string $type): string
    {
        $taille = @getimagesize($chemin);

        if ($taille === false || (int) config('documents.image_max_pixels') < $taille[0] * $taille[1]) {
            throw ErrorCode::FileUnsafe->problem();
        }

        $image = match ($type) {
            'image/jpeg' => @imagecreatefromjpeg($chemin),
            'image/png' => @imagecreatefrompng($chemin),
            default => @imagecreatefromwebp($chemin),
        };

        if ($image === false) {
            throw ErrorCode::FileUnsafe->problem();
        }

        if ($type === 'image/jpeg') {
            $image = self::straighten($image, $chemin);
        } else {
            imagesavealpha($image, true);
        }

        $sortie = TempFile::create();

        $ecrit = match ($type) {
            'image/jpeg' => imagejpeg($image, $sortie, 90),
            'image/png' => imagepng($image, $sortie),
            default => imagewebp($image, $sortie, 90),
        };

        if (! $ecrit) {
            @unlink($sortie);

            throw ErrorCode::FileUnsafe->problem();
        }

        return $sortie;
    }

    /**
     * L'orientation vit dans l'EXIF : elle est appliquée aux pixels avant que l'EXIF ne disparaisse.
     */
    private static function straighten(\GdImage $image, string $chemin): \GdImage
    {
        $exif = function_exists('exif_read_data') ? @exif_read_data($chemin) : false;
        $orientation = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;
        $angle = match ($orientation) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };

        return $angle === 0 ? $image : (imagerotate($image, $angle, 0) ?: $image);
    }
}
