<?php

declare(strict_types=1);

namespace App\Modules\Investments\Data;

use Money\Money;

final readonly class AcquisitionData
{
    /**
     * @param  string  $acquiredOn  Y-m-d
     * @param  Money  $cost  prix de revient : prix, frais d'acquisition, frais d'agence et travaux initiaux
     */
    public function __construct(
        public string $propertyId,
        public ?string $unitId,
        public string $acquiredOn,
        public Money $cost,
    ) {}
}
