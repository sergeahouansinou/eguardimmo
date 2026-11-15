<?php

declare(strict_types=1);

namespace App\Modules\Documents\Enums;

enum FileCategory: string
{
    case Supporting = 'supporting';
    case Certificate = 'certificate';
    case Issued = 'issued';
    case Bundle = 'bundle';

    public const PDF = 'application/pdf';

    public const ZIP = 'application/zip';

    /**
     * @return array<string, string> type MIME => extension du nom stocké
     */
    public function allowedTypes(): array
    {
        return match ($this) {
            self::Supporting, self::Certificate => [
                self::PDF => 'pdf',
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
            ],
            self::Issued => [self::PDF => 'pdf'],
            self::Bundle => [self::ZIP => 'zip'],
        };
    }

    public function maxBytes(): int
    {
        return match ($this) {
            self::Bundle => 100 * 1024 * 1024,
            default => 10 * 1024 * 1024,
        };
    }

    /**
     * @return list<string>
     */
    public static function uploadable(): array
    {
        return [self::Supporting->value, self::Certificate->value];
    }
}
