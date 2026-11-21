<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Catalog\Enums\InvoiceItemSemantic;
use App\Modules\Invoicing\Enums\TaxCategory;
use App\Modules\Invoicing\Jurisdictions\ResolvedRate;

/**
 * Une ligne à chiffrer. Un avoir fixe le taux et le net de la ligne d'origine (`$fixedRate`, `$fixedNet`) ; une facture
 * laisse le serveur les déterminer.
 */
final readonly class PricingLine
{
    public function __construct(
        public string $itemTermId,
        public InvoiceItemSemantic $semantic,
        public string $description,
        public int $quantityMilli,
        public int $unitPrice,
        public TaxCategory $category,
        public ?string $rateKey,
        public ?ResolvedRate $fixedRate = null,
        public ?int $fixedNet = null,
        public ?string $creditedLineId = null,
    ) {}
}
