<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

use App\Modules\Invoicing\Enums\TaxCategory;

final readonly class NewLineData
{
    /**
     * @param  int  $quantityMilli  1 000 = une unité
     * @param  int  $unitPrice  hors taxe, unités mineures de la devise de la facture : la devise ne vient jamais du client
     * @param  string|null  $taxRateKey  clé de la valeur du référentiel `tax_rate` ; jamais un pourcentage
     */
    public function __construct(
        public string $itemTermId,
        public string $description,
        public int $quantityMilli,
        public int $unitPrice,
        public TaxCategory $taxCategory,
        public ?string $taxRateKey,
    ) {}
}
