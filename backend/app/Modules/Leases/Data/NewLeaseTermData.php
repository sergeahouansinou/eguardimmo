<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class NewLeaseTermData
{
    /**
     * @param  int  $amount  unités mineures, dans la devise du bail
     * @param  ?string  $validFrom  Y-m-d ; défaut : début du bail
     */
    public function __construct(
        public string $componentTermId,
        public int $amount,
        public int $vatBp = 0,
        public bool $indexed = false,
        public ?string $validFrom = null,
    ) {}
}
