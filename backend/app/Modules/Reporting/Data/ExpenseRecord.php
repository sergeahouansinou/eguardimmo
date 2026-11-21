<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Data;

final readonly class ExpenseRecord
{
    /**
     * @param  string  $semantic  sens de catégorie (`expense.insurance`…) ; `expense.other` sans sens
     * @param  int  $amount  unités mineures, part récupérable déduite
     */
    public function __construct(
        public ?string $propertyId,
        public ?string $unitId,
        public string $semantic,
        public int $amount,
    ) {}
}
