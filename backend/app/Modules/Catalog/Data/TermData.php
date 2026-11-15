<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Data;

/**
 * Valeur de référentiel avec les surcharges de l'organisation courante appliquées.
 */
final readonly class TermData
{
    /**
     * @param  array<string, string>  $labels
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public string $id,
        public string $vocabulary,
        public string $key,
        public array $labels,
        public ?string $semanticKey,
        public ?string $parentId,
        public int $position,
        public array $metadata,
        public bool $isPlatform,
        public bool $isSystem,
        public bool $isArchived,
        public bool $isHidden,
        public bool $isOverridden,
    ) {}

    public function label(string $locale = 'fr'): string
    {
        return $this->labels[$locale] ?? $this->labels['fr'] ?? array_values($this->labels)[0] ?? $this->key;
    }
}
