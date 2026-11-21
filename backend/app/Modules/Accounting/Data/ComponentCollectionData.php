<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Data;

use App\Modules\Accounting\Enums\CollectionComponent;
use Money\Money;

final readonly class ComponentCollectionData
{
    /**
     * Encaissement net des contrepassations, par bail, lot, mois et composant. `unitId` est nul pour une avance (la ligne du grand livre
     * ne porte que le bail).
     *
     * @param  string  $month  Y-m
     */
    public function __construct(
        public ?string $leaseId,
        public ?string $unitId,
        public string $month,
        public CollectionComponent $component,
        public Money $amount,
    ) {}
}
