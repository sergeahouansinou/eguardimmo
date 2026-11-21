<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Documents\PublicApi\ImageScrubber;
use Closure;
use finfo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class AttachmentStore
{
    public const DISQUE = 'local';

    public const MAX_KO = 10240;

    public const MAX_FICHIERS = 5;

    public const TYPES = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    /**
     * @return list<mixed>
     */
    public static function rules(): array
    {
        return ['file', 'max:'.self::MAX_KO, self::contenuAccepte(...)];
    }

    public static function typeReel(UploadedFile $fichier): ?string
    {
        $chemin = $fichier->getRealPath();
        $type = $chemin === false ? false : (new finfo(FILEINFO_MIME_TYPE))->file($chemin);

        return is_string($type) && array_key_exists($type, self::TYPES) ? $type : null;
    }

    private static function contenuAccepte(string $attribut, mixed $valeur, Closure $echec): void
    {
        if (! $valeur instanceof UploadedFile || self::typeReel($valeur) === null) {
            $echec('Seuls les PDF et les images JPEG, PNG ou WebP sont acceptés.');
        }
    }

    /**
     * @return array{original_name: string, mime_type: string, size_bytes: int, path: string}
     */
    public static function store(UploadedFile $fichier, string $dossier): array
    {
        $type = self::typeReel($fichier) ?? throw new InvalidArgumentException('Type de fichier non validé.');
        $chemin = $dossier.'/'.Str::uuid7()->toString().'.'.self::TYPES[$type];

        $nettoyeur = app(ImageScrubber::class);
        $nettoye = $nettoyeur->applies($type) ? $nettoyeur->clean((string) $fichier->getRealPath(), $type) : null;

        if ($nettoye === null) {
            Storage::disk(self::DISQUE)->putFileAs($dossier, $fichier, basename($chemin));
        } else {
            try {
                $flux = fopen($nettoye, 'rb');
                Storage::disk(self::DISQUE)->put($chemin, $flux === false ? '' : $flux);
            } finally {
                @unlink($nettoye);
            }
        }

        return [
            'original_name' => self::displayName($fichier),
            'mime_type' => $type,
            // Taille reçue, non celle du fichier réencodé : PostSupportMessage::matches() s'en sert pour reconnaître un rejeu.
            'size_bytes' => (int) $fichier->getSize(),
            'path' => $chemin,
        ];
    }

    public static function displayName(UploadedFile $fichier): string
    {
        return Str::limit(self::nomLisible($fichier->getClientOriginalName()), 250, '');
    }

    private static function nomLisible(string $nom): string
    {
        $propre = trim((string) preg_replace('/[\x00-\x1F\x7F\/\\\\]/u', '', mb_scrub($nom, 'UTF-8')));

        return $propre === '' ? 'piece-jointe' : $propre;
    }

    public static function response(string $chemin, string $nom, string $type): StreamedResponse
    {
        $reponse = Storage::disk(self::DISQUE)->download($chemin, $nom, [
            'Content-Type' => $type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
        $reponse->setPrivate();

        return $reponse;
    }

    public static function exists(string $chemin): bool
    {
        return Storage::disk(self::DISQUE)->exists($chemin);
    }
}
