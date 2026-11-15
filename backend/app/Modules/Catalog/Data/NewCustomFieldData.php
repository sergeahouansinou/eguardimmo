<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Data;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Enums\VocabularyKey;

final readonly class NewCustomFieldData
{
    /**
     * @param  array<string, string>  $labels
     * @param  list<array{key: string, labels: array<string, string>}>|null  $options
     */
    public function __construct(
        public CustomFieldEntity $entity,
        public string $key,
        public array $labels,
        public CustomFieldType $type,
        public ?VocabularyKey $vocabulary,
        public ?array $options,
        public bool $required,
    ) {}
}
