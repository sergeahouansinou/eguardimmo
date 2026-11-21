<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Jurisdictions\InvoiceTaxRules;
use App\Modules\Organizations\Enums\VatRegime;
use Carbon\CarbonImmutable;
use Money\Money;

/**
 * Calcul en entiers (moneyphp, jamais de flottant) : net de ligne = quantité × prix unitaire ÷ 1 000, arrondi au demi
 * supérieur ; taxe calculée une seule fois par couple (taxe, catégorie, taux) sur la somme des bases (EN 16931).
 */
final readonly class Calculator
{
    private const int LIGNES_MAX = 100;

    private const int QUANTITE_MAX = 1_000_000_000;

    private const int PRIX_MAX = 10_000_000_000;

    private const int DIVISEUR_TAUX = 100_000;

    /**
     * @param  list<PricingLine>  $lignes
     */
    public function price(array $lignes, InvoiceTaxRules $regles, VatRegime $regime, CarbonImmutable $date, string $devise, bool $recipientIsVatRegisteredCompany): PricedInvoice
    {
        if ($lignes === [] || count($lignes) > self::LIGNES_MAX) {
            throw ErrorCode::LinesInvalid->problem();
        }

        $monnaie = Currencies::of($devise);
        $chiffrees = [];
        $groupes = [];
        $net = 0;

        foreach ($lignes as $ligne) {
            if ($ligne->quantityMilli < 1 || $ligne->quantityMilli > self::QUANTITE_MAX || $ligne->unitPrice < 0 || $ligne->unitPrice > self::PRIX_MAX) {
                throw ErrorCode::LinesInvalid->problem();
            }

            $taux = $ligne->fixedRate;

            if ($taux === null) {
                $taux = $regles->rate($regles->effectiveCategory($regime, $ligne->category), $regime === VatRegime::Franchise ? null : $ligne->rateKey, $date);
                $regles->assertRateAllowed($regime, $ligne->semantic, $taux, $recipientIsVatRegisteredCompany);
            }

            $montant = $ligne->fixedNet ?? (int) (new Money($ligne->unitPrice, $monnaie))->multiply($ligne->quantityMilli)->divide(1000)->getAmount();
            $chiffrees[] = new PricedLine($ligne, $taux, $montant);
            $net += $montant;
            $cle = "{$taux->code->value}|{$taux->category->value}|{$taux->ratePcm}";
            $groupes[$cle] = [$taux, ($groupes[$cle][1] ?? 0) + $montant];
        }

        $taxes = [];
        $tva = 0;

        foreach ($groupes as [$taux, $base]) {
            $montant = (int) (new Money($base, $monnaie))->multiply($taux->ratePcm)->divide(self::DIVISEUR_TAUX)->getAmount();
            $taxes[] = new TaxGroup($taux->code, $taux->category, $taux->ratePcm, $base, $montant);
            $tva += $montant;
        }

        return new PricedInvoice($chiffrees, $taxes, $net, $tva, $devise);
    }
}
