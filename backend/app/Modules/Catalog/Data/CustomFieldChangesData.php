<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Data;

use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Enums\VocabularyKey;

/**
 * Un champ nul reste inchangé ; `vocabulary` et `options` n'ont de sens que pour leur type.
 */
final readonly class CustomFieldChangesData
{
    /**
     * @param  array<string, string>|null  $labels
     * @param  list<array{key: string, labels: array<string, string>}>|null  $options
     */
    public function __construct(
        public ?array $labels = null,
        public ?CustomFieldType $type = null,
        public ?VocabularyKey $vocabulary = null,
        public ?array $options = null,
        public ?bool $required = null,
        public ?int $position = null,
    ) {}
}
