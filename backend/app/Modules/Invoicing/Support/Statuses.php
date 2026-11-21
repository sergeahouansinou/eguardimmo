<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Models\Invoice;
use Money\Money;

/**
 * Le statut de règlement se recalcule dans la transaction de chaque règlement ou avoir, à partir du reste dû lu au grand
 * livre : le grand livre est la seule source des soldes (ADR 0007).
 */
final readonly class Statuses
{
    public function __construct(
        private LedgerReader $livre,
        private CreditedTotals $avoirs,
    ) {}

    public function outstanding(Invoice $facture): Money
    {
        return $this->livre->outstanding(ItemType::Invoice, $facture->id, Currencies::of($facture->currency));
    }

    public function sync(Invoice $facture): void
    {
        $reste = (int) $this->outstanding($facture)->getAmount();
        $total = (int) $facture->total_gross->getAmount();

        $statut = match (true) {
            $reste <= 0 => $this->avoirs->of($facture->id)['gross'] >= $total ? InvoiceStatus::Cancelled : InvoiceStatus::Paid,
            $reste >= $total => InvoiceStatus::Issued,
            default => InvoiceStatus::PartiallyPaid,
        };

        if ($facture->status !== $statut) {
            $facture->status = $statut;
        }

        $facture->lock_version++;
        $facture->save();
    }
}
