<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Jurisdictions\InvoiceTaxRules;
use App\Modules\Organizations\Enums\VatRegime;

final readonly class PricedDraft
{
    public function __construct(
        public InvoiceTaxRules $rules,
        public ReferenceContext $references,
        public PricedInvoice $priced,
        public string $jurisdiction,
        public VatRegime $regime,
        public bool $vatOnDebits,
    ) {}
}
