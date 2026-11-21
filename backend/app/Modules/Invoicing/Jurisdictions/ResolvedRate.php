<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Jurisdictions;

use App\Modules\Invoicing\Enums\TaxCategory;
use App\Modules\Invoicing\Enums\TaxCode;

/**
 * Taux d'une catégorie de taxe à une date, lu dans les données datées du Catalog (cent-millièmes : 100 000 = 100 %).
 */
final readonly class ResolvedRate
{
    public function __construct(
        public TaxCode $code,
        public TaxCategory $category,
        public int $ratePcm,
        public ?string $key,
    ) {}
}
