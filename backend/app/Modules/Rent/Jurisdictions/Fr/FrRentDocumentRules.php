<?php

declare(strict_types=1);

namespace App\Modules\Rent\Jurisdictions\Fr;

use App\Modules\Rent\Jurisdictions\RentDocumentRules;

/**
 * Loi n° 89-462 du 6 juillet 1989, art. 21 (quittance gratuite, loyer et charges distingués) et art. 7-1 (prescription
 * de trois ans). Formules à faire valider par un juriste avant la mise en production (ADR 0011).
 */
final class FrRentDocumentRules implements RentDocumentRules
{
    public function jurisdiction(): string
    {
        return 'FR';
    }

    public function templateVersion(): string
    {
        return 'fr-2026-11';
    }

    public function noticeMention(): string
    {
        return 'Cet avis d\'échéance est un appel de loyer : il ne vaut pas quittance et ne prouve aucun paiement.';
    }

    public function receiptMention(): string
    {
        return 'Quittance délivrée gratuitement en application de l\'article 21 de la loi n° 89-462 du 6 juillet 1989 ; le loyer et les charges y sont distingués. '
            .'Cette quittance annule tous les reçus établis précédemment en cas de paiement partiel du montant du présent terme. '
            .'Elle est à conserver pendant trois ans par le locataire (article 7-1 de la même loi).';
    }
}
