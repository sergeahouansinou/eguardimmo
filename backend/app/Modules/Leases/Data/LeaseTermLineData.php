<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use Money\Money;

final readonly class LeaseTermLineData
{
    /**
     * @param  ?LeaseComponentSemantic  $semantic  sens système de la composante ; null pour une composante propre à l'organisation sans sens
     * @param  string  $validFrom  Y-m-d
     * @param  ?string  $validTo  Y-m-d, exclu
     */
    public function __construct(
        public string $id,
        public string $leaseId,
        public string $componentTermId,
        public string $componentKey,
        public ?LeaseComponentSemantic $semantic,
        public Money $amount,
        public int $vatBp,
        public bool $indexed,
        public string $validFrom,
        public ?string $validTo,
    ) {}
}
