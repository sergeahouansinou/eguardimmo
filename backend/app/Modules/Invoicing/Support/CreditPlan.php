<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Catalog\Enums\InvoiceItemSemantic;
use App\Modules\Invoicing\Data\CreditNoteData;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\TaxCode;
use App\Modules\Invoicing\Jurisdictions\ResolvedRate;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Invoicing\Models\InvoiceLine;
use App\Modules\Invoicing\Models\InvoiceTax;
use Money\Money;

/**
 * Lignes d'un avoir : quantités créditées par ligne d'origine, avec le taux de la ligne d'origine. Le solde d'une
 * ligne soldée reprend exactement son net d'origine, sans écart d'arrondi ; le cumul des nets crédités ne le dépasse jamais.
 */
final class CreditPlan
{
    /**
     * @param  array{gross: int, tax: int, quantities: array<string, int>, nets: array<string, int>}  $deja  avoirs déjà émis
     * @return list<PricingLine>
     */
    public function lines(Invoice $origine, CreditNoteData $demande, array $deja): array
    {
        $lignes = $origine->lines()->get()->keyBy('id');
        $quantites = [];

        if ($demande->full) {
            foreach ($lignes as $id => $ligne) {
                $quantites[(string) $id] = $ligne->quantity_milli - ($deja['quantities'][$id] ?? 0);
            }
        } else {
            foreach ($demande->lines as $ligne) {
                if (isset($quantites[$ligne->lineId]) || ! $lignes->has($ligne->lineId) || $ligne->quantityMilli < 1) {
                    throw ErrorCode::LinesInvalid->problem();
                }

                $quantites[$ligne->lineId] = $ligne->quantityMilli;
            }
        }

        $taxes = InvoiceTax::query()->where('invoice_id', $origine->id)->get();
        $plan = [];

        foreach ($quantites as $id => $quantite) {
            $ligne = $lignes->get($id);

            if ($ligne === null || $quantite <= 0) {
                continue;
            }

            $dejaCredite = $deja['quantities'][$id] ?? 0;

            if ($dejaCredite + $quantite > $ligne->quantity_milli) {
                throw ErrorCode::CreditExceedsLine->problem();
            }

            $netRestant = $ligne->net_amount - ($deja['nets'][$id] ?? 0);

            if ($netRestant < 0) {
                throw ErrorCode::CreditExceedsLine->problem();
            }

            $solde = $dejaCredite + $quantite === $ligne->quantity_milli;
            $net = $solde ? $netRestant : min($netRestant, (int) (new Money($ligne->unit_price, Currencies::of($origine->currency)))->multiply($quantite)->divide(1000)->getAmount());
            $plan[] = new PricingLine(
                $ligne->item_term_id,
                InvoiceItemSemantic::from($ligne->item_semantic),
                $ligne->description,
                $quantite,
                $ligne->unit_price,
                $ligne->tax_category,
                $ligne->tax_rate_key,
                new ResolvedRate($this->code(array_values($taxes->all()), $ligne), $ligne->tax_category, $ligne->tax_rate_pcm, $ligne->tax_rate_key),
                $net,
                $ligne->id,
            );
        }

        if ($plan === []) {
            throw ErrorCode::CreditExceedsLine->problem();
        }

        return $plan;
    }

    /**
     * @param  list<InvoiceTax>  $taxes
     */
    private function code(array $taxes, InvoiceLine $ligne): TaxCode
    {
        foreach ($taxes as $taxe) {
            if ($taxe->category === $ligne->tax_category && $taxe->rate_pcm === $ligne->tax_rate_pcm) {
                return $taxe->tax_code;
            }
        }

        return TaxCode::Vat;
    }
}
