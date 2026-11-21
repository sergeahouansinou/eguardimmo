<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;

/**
 * Avoirs déjà émis sur une facture : à lire sous le verrou de la facture d'origine.
 */
final class CreditedTotals
{
    /**
     * @return array{gross: int, tax: int, quantities: array<string, int>, nets: array<string, int>}
     */
    public function of(string $invoiceId): array
    {
        $avoirs = Invoice::query()
            ->where('credited_invoice_id', $invoiceId)
            ->where('kind', InvoiceKind::CreditNote->value)
            ->whereNotNull('number')
            ->get(['id', 'total_gross', 'total_tax', 'currency']);

        $gross = 0;
        $tax = 0;

        foreach ($avoirs as $avoir) {
            $gross += (int) $avoir->total_gross->getAmount();
            $tax += (int) $avoir->total_tax->getAmount();
        }

        $quantites = [];
        $nets = [];

        if ($avoirs->isNotEmpty()) {
            foreach (InvoiceLine::query()->whereIn('invoice_id', $avoirs->modelKeys())->whereNotNull('credited_line_id')->get() as $ligne) {
                $cle = (string) $ligne->credited_line_id;
                $quantites[$cle] = ($quantites[$cle] ?? 0) + $ligne->quantity_milli;
                $nets[$cle] = ($nets[$cle] ?? 0) + $ligne->net_amount;
            }
        }

        return ['gross' => $gross, 'tax' => $tax, 'quantities' => $quantites, 'nets' => $nets];
    }
}
