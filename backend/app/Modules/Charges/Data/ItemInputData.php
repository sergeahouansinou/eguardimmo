<?php

declare(strict_types=1);

namespace App\Modules\Charges\Data;

final readonly class ItemInputData
{
    /**
     * @param  list<SourceInputData>  $sources
     * @param  array<string, int>  $consumptions  quantité en millièmes par lot, pour une clé de consommation
     */
    public function __construct(
        public string $label,
        public string $rubric,
        public ?string $keyId,
        public ?string $unitId,
        public array $sources,
        public array $consumptions,
    ) {}
}
