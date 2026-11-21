<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Enums\ErrorCode;
use finfo;

/**
 * Fichier déposé, contrôlé sur son contenu et jamais sur son extension : taille, archive, octets nuls, code PHP, type MIME,
 * cohérence avec le format annoncé. Le contenu rendu est du texte UTF-8 sans BOM.
 */
final readonly class StatementFile
{
    private const MIME_AUTORISES = ['text/plain', 'text/csv', 'application/csv', 'text/xml', 'application/xml'];

    private function __construct(
        public string $raw,
        public string $text,
        public string $sha256,
        public bool $isXml,
    ) {}

    public static function read(string $path, bool $expectsXml, string $encoding = 'UTF-8'): self
    {
        $taille = is_file($path) ? filesize($path) : false;

        if ($taille === false || $taille === 0) {
            throw ErrorCode::StatementInvalid->problem('Le fichier est vide ou illisible.');
        }

        if ($taille > (int) config('banking.import_max_bytes')) {
            throw ErrorCode::StatementTooLarge->problem();
        }

        $brut = file_get_contents($path);

        if ($brut === false) {
            throw ErrorCode::StatementInvalid->problem('Le fichier est illisible.');
        }

        if (str_starts_with($brut, "PK\x03\x04") || str_starts_with($brut, "\x1f\x8b") || str_contains($brut, "\0")) {
            throw ErrorCode::StatementFormatUnsupported->problem();
        }

        if (preg_match('/<\?(php|=)/i', $brut) === 1) {
            throw ErrorCode::StatementFormatUnsupported->problem();
        }

        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($brut);

        if (! is_string($mime) || ! in_array($mime, self::MIME_AUTORISES, true)) {
            throw ErrorCode::StatementFormatUnsupported->problem();
        }

        $texte = str_starts_with($brut, "\xEF\xBB\xBF") ? substr($brut, 3) : $brut;
        $xml = str_starts_with(ltrim($texte), '<');

        if ($xml !== $expectsXml) {
            throw ErrorCode::StatementFormatUnsupported->problem();
        }

        if (! $xml) {
            $texte = self::decode($texte, $encoding);
        } elseif (! mb_check_encoding($texte, 'UTF-8')) {
            throw ErrorCode::StatementFormatUnsupported->problem();
        }

        return new self($brut, $texte, hash('sha256', $brut), $xml);
    }

    private static function decode(string $texte, string $encoding): string
    {
        if ($encoding === 'Windows-1252') {
            return mb_convert_encoding($texte, 'UTF-8', 'Windows-1252');
        }

        if (! mb_check_encoding($texte, 'UTF-8')) {
            throw ErrorCode::StatementInvalid->problem("Le fichier n'est pas en UTF-8 ; indiquez l'encodage dans le profil du compte.");
        }

        return $texte;
    }
}
