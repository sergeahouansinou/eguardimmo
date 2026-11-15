<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Data;

final readonly class NewTermData
{
    /**
     * @param  array<string, string>  $labels
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public string $key,
        public array $labels,
        public ?string $semanticKey,
        public ?string $parentId,
        public array $metadata,
    ) {}
}
