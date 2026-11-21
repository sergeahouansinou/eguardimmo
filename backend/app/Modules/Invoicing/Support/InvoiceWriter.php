<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Invoicing\Models\InvoiceTax;
use Money\Money;

/**
 * Écrit lignes, taxes et totaux d'une pièce encore en brouillon (les triggers refusent le reste).
 */
final class InvoiceWriter
{
    public function write(Invoice $facture, PricedInvoice $chiffree): void
    {
        InvoiceTax::query()->where('invoice_id', $facture->id)->delete();
        InvoiceLine::query()->where('invoice_id', $facture->id)->delete();

        foreach ($chiffree->lines as $position => $ligne) {
            InvoiceLine::query()->create([
                'invoice_id' => $facture->id,
                'position' => $position + 1,
                'item_term_id' => $ligne->line->itemTermId,
                'item_semantic' => $ligne->line->semantic->value,
                'description' => $ligne->line->description,
                'quantity_milli' => $ligne->line->quantityMilli,
                'unit_price' => $ligne->line->unitPrice,
                'net_amount' => $ligne->net,
                'tax_category' => $ligne->rate->category,
                'tax_rate_key' => $ligne->rate->key,
                'tax_rate_pcm' => $ligne->rate->ratePcm,
                'credited_line_id' => $ligne->line->creditedLineId,
            ]);
        }

        foreach ($chiffree->taxes as $position => $groupe) {
            InvoiceTax::query()->create([
                'invoice_id' => $facture->id,
                'position' => $position + 1,
                'tax_code' => $groupe->code,
                'category' => $groupe->category,
                'rate_pcm' => $groupe->ratePcm,
                'base_amount' => $groupe->base,
                'tax_amount' => $groupe->tax,
            ]);
        }

        $devise = Currencies::of($chiffree->currency);
        $facture->total_net = new Money($chiffree->net, $devise);
        $facture->total_tax = new Money($chiffree->tax, $devise);
        $facture->total_gross = new Money($chiffree->gross(), $devise);
        $facture->save();
        $facture->unsetRelation('lines');
        $facture->unsetRelation('taxes');
    }
}
