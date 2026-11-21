<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Maintenance\Data\TaxBucketData;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\TaxCategory;
use Carbon\CarbonImmutable;

/**
 * Taxes d'une facture reçue, telles qu'imprimées : le client donne base et taxe par taux, le serveur ne retient que la catégorie
 * et le taux du référentiel et vérifie base × taux = taxe, à la tolérance d'arrondi près (ADR 0029).
 */
final readonly class InvoiceTaxes
{
    public function __construct(private TaxRates $taux) {}

    /**
     * @param  list<array{tax_rate_key: string, base: int, tax: int}>  $lignes
     * @return list<TaxBucketData>
     */
    public function check(array $lignes, CarbonImmutable $date): array
    {
        if ($lignes === [] || count($lignes) > 10) {
            throw ErrorCode::InvoiceTotalsInvalid->problem();
        }

        $tolerance = Settings::taxToleranceMinor();
        $groupes = [];
        $vus = [];

        foreach ($lignes as $ligne) {
            $taux = $this->taux->resolve($ligne['tax_rate_key'], $date);
            $cle = $taux['category']->value.'|'.$taux['ratePcm'];

            if (isset($vus[$cle]) || $ligne['base'] < 0 || $ligne['tax'] < 0) {
                throw ErrorCode::InvoiceTotalsInvalid->problem();
            }

            $vus[$cle] = true;
            $attendu = $taux['category'] === TaxCategory::Standard ? intdiv($ligne['base'] * $taux['ratePcm'] + 50000, 100000) : 0;

            if (abs($attendu - $ligne['tax']) > $tolerance) {
                throw ErrorCode::InvoiceTotalsInvalid->problem();
            }

            $groupes[] = new TaxBucketData($taux['category'], $taux['ratePcm'], $ligne['base'], $ligne['tax']);
        }

        return $groupes;
    }
}
