<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Catalog\Enums\InvoiceItemSemantic;

final class ItemAccounts
{
    /**
     * Chaque sens de ligne fixe son compte de produit.
     */
    public static function revenue(InvoiceItemSemantic $nature): AccountRole
    {
        return match ($nature) {
            InvoiceItemSemantic::FeeManagement, InvoiceItemSemantic::FeeLetting, InvoiceItemSemantic::FeeOther, InvoiceItemSemantic::Service => AccountRole::FeeRevenue,
            InvoiceItemSemantic::RecoveryCost => AccountRole::CollectionFees,
        };
    }
}
