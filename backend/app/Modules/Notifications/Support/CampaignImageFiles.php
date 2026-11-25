<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Models\PlatformCampaignImage;
use finfo;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Images d'une campagne : contenu vérifié, nom d'affichage nettoyé, chemin régénéré sur le disque privé.
 */
final class CampaignImageFiles
{
    public const int MAX_IMAGES = 5;

    public const int MAX_BYTES = 2097152;

    public const int MAX_TOTAL_BYTES = 6291456;

    private const int MAX_SIDE = 6000;

    private const int MAX_PIXELS = 20000000;

    private const string DISK = 'local';

    private const array EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif'];

    public function problem(UploadedFile $fichier): ?string
    {
        if (! $fichier->isValid()) {
            return 'Le fichier n\'a pas été reçu entièrement.';
        }

        if ((int) $fichier->getSize() > self::MAX_BYTES) {
            return 'Une image pèse 2 Mo au plus.';
        }

        $type = $this->mime($fichier);
        $dimensions = $type === null ? false : @getimagesize($fichier->getPathname());

        if ($type === null || $dimensions === false || $dimensions['mime'] !== $type) {
            return 'Seules les images JPEG, PNG et GIF sont acceptées.';
        }

        [$largeur, $hauteur] = $dimensions;

        return $largeur < 1 || $hauteur < 1 || $largeur > self::MAX_SIDE || $hauteur > self::MAX_SIDE || $largeur * $hauteur > self::MAX_PIXELS
            ? 'Les dimensions de l\'image sont trop grandes (6000 pixels par côté et 20 millions de pixels au plus).'
            : null;
    }

    /**
     * @return array{path: string, name: string, mime: string, size_bytes: int}
     */
    public function store(string $campagneId, string $imageId, UploadedFile $fichier): array
    {
        $type = $this->mime($fichier) ?? throw new RuntimeException('Image non vérifiée.');
        $chemin = "platform-campaigns/{$campagneId}/{$imageId}.".self::EXTENSIONS[$type];
        $contenu = (string) file_get_contents($fichier->getPathname());

        if (! $this->disk()->put($chemin, $contenu)) {
            throw new RuntimeException('Écriture de l\'image impossible.');
        }

        return ['path' => $chemin, 'name' => $this->displayName($fichier->getClientOriginalName(), self::EXTENSIONS[$type]), 'mime' => $type, 'size_bytes' => strlen($contenu)];
    }

    public function contents(PlatformCampaignImage $image): string
    {
        return $this->disk()->get($image->path) ?? throw new RuntimeException("Image de campagne absente du disque : {$image->id}.");
    }

    /**
     * @param  list<string>  $chemins
     */
    public function delete(array $chemins): void
    {
        if ($chemins !== []) {
            $this->disk()->delete($chemins);
        }
    }

    private function mime(UploadedFile $fichier): ?string
    {
        $type = (new finfo(FILEINFO_MIME_TYPE))->file($fichier->getPathname());

        return is_string($type) && isset(self::EXTENSIONS[$type]) ? $type : null;
    }

    private function displayName(string $origine, string $extension): string
    {
        $base = pathinfo(str_replace('\\', '/', mb_scrub($origine, 'UTF-8')), PATHINFO_FILENAME);
        $base = trim((string) preg_replace('/[\p{C}\/\\\\:*?"<>|;]+/u', ' ', $base), " .\t");
        $base = Str::limit($base, 100, '');

        return ($base === '' ? 'image' : $base).'.'.$extension;
    }

    private function disk(): Filesystem
    {
        return Storage::disk(self::DISK);
    }
}
