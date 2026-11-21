<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Data\PricedLineData;
use App\Modules\Maintenance\Data\PricedQuoteData;
use App\Modules\Maintenance\Data\TaxBucketData;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\TaxCategory;
use Carbon\CarbonImmutable;

/**
 * Le serveur recalcule net, taxe et TTC en entiers : demi vers le haut sur la ligne, puis taxe par taux sur la somme des bases
 * (même arrondi que l'ADR 0028).
 */
final readonly class Pricing
{
    private const MAX = 100_000_000_000;

    public function __construct(private TaxRates $taux) {}

    /**
     * @param  list<array{label: string, quantity_milli: int, unit: string|null, unit_price: int, tax_rate_key: string}>  $lignes
     */
    public function quote(array $lignes, CarbonImmutable $date): PricedQuoteData
    {
        if ($lignes === [] || count($lignes) > 100) {
            throw ErrorCode::QuoteLinesInvalid->problem();
        }

        $chiffrees = [];
        $bases = [];

        foreach ($lignes as $i => $ligne) {
            $taux = $this->taux->resolve($ligne['tax_rate_key'], $date);
            if ($ligne['quantity_milli'] < 1 || $ligne['unit_price'] < 0 || $ligne['unit_price'] > intdiv(self::MAX * 1000, max(1, $ligne['quantity_milli']))) {
                throw ErrorCode::QuoteLinesInvalid->problem('Le montant d\'une ligne dépasse le maximum admis.');
            }

            $net = intdiv($ligne['quantity_milli'] * $ligne['unit_price'] + 500, 1000);
            $chiffrees[] = new PricedLineData($i + 1, $ligne['label'], $ligne['quantity_milli'], $ligne['unit'], $ligne['unit_price'], $net, $taux['category'], $taux['ratePcm']);
            $cle = $taux['category']->value.'|'.$taux['ratePcm'];
            $bases[$cle] = ($bases[$cle] ?? 0) + $net;

            if ($bases[$cle] > self::MAX) {
                throw ErrorCode::QuoteLinesInvalid->problem('Le total du devis dépasse le maximum admis.');
            }
        }

        $groupes = [];
        $net = 0;
        $tva = 0;

        foreach ($bases as $cle => $base) {
            [$categorie, $taux] = explode('|', $cle);
            $taxe = TaxCategory::from($categorie) === TaxCategory::Standard ? intdiv($base * (int) $taux + 50000, 100000) : 0;
            $groupes[] = new TaxBucketData(TaxCategory::from($categorie), (int) $taux, $base, $taxe);
            $net += $base;
            $tva += $taxe;
        }

        return new PricedQuoteData($chiffrees, $groupes, $net, $tva);
    }
}
