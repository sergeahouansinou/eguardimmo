<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

use InvalidArgumentException;

/**
 * Contenu à stocker : une chaîne en mémoire ou le chemin d'un fichier temporaire que l'appelant garde à sa charge.
 */
final readonly class FileSource
{
    private function __construct(
        public ?string $contents,
        public ?string $path,
    ) {}

    public static function contents(string $contents): self
    {
        return new self($contents, null);
    }

    public static function path(string $path): self
    {
        if (! is_file($path) || ! is_readable($path)) {
            throw new InvalidArgumentException('Fichier source illisible.');
        }

        return new self(null, $path);
    }
}
