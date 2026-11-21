<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Support;

use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Properties\Data\UnitData;

final readonly class OwnerUnitView
{
    /**
     * @param  string  $coveredFrom  premier jour couvert par un mandat du compte
     * @param  string  $coveredUntil  dernier jour couvert, inclus
     */
    public function __construct(
        public UnitData $unit,
        public string $organizationId,
        public ?string $agencyName,
        public ?OwnerVisibleData $visible,
        public string $coveredFrom,
        public string $coveredUntil,
    ) {}
}
