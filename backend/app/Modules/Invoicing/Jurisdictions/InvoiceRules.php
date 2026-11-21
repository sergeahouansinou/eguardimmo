<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Jurisdictions;

use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Jurisdictions\Fr\FrInvoiceTaxRules;

final class InvoiceRules
{
    /** @var array<string, InvoiceTaxRules> */
    private array $index;

    public function __construct(FrInvoiceTaxRules $fr)
    {
        $this->index = [$fr->jurisdiction() => $fr];
    }

    /**
     * Aucun repli : une juridiction sans règles de facturation est refusée.
     */
    public function for(string $jurisdiction): InvoiceTaxRules
    {
        return $this->index[$jurisdiction] ?? throw ErrorCode::JurisdictionUnsupported->problem();
    }
}
