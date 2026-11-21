<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Jurisdictions;

use App\Modules\Catalog\Enums\InvoiceItemSemantic;
use App\Modules\Invoicing\Enums\TaxCategory;
use App\Modules\Organizations\Enums\VatRegime;
use App\Modules\Parties\Data\PartyInvoiceData;
use Carbon\CarbonImmutable;

/**
 * Règles de facturation d'une juridiction : taux, mentions, exigibilité, facture électronique (ADR 0008 : une interface
 * par contrat de juridiction, jamais de condition sur le pays).
 */
interface InvoiceTaxRules
{
    public function jurisdiction(): string;

    public function currency(): string;

    public function templateVersion(): string;

    /**
     * La catégorie réellement appliquée : le régime de franchise impose la catégorie « hors champ ».
     */
    public function effectiveCategory(VatRegime $regime, TaxCategory $demandee): TaxCategory;

    /**
     * Lève invoice_tax_rate_unknown quand aucun taux de la catégorie n'est en vigueur à cette date.
     */
    public function rate(TaxCategory $category, ?string $rateKey, CarbonImmutable $date): ResolvedRate;

    /**
     * La TVA des prestations de services est exigible à l'encaissement, sauf option pour les débits.
     */
    /**
     * Liste blanche des taux et catégories selon le régime, la nature de ligne et le destinataire ; lève invoice_tax_rate_not_allowed.
     */
    public function assertRateAllowed(VatRegime $regime, InvoiceItemSemantic $nature, ResolvedRate $taux, bool $recipientIsVatRegisteredCompany): void;

    /**
     * Clé du taux appliqué aux honoraires de gestion facturés par le serveur.
     */
    public function managementFeeRateKey(): string;

    public function isVatDeferred(bool $vatOnDebits): bool;

    /**
     * Lève invoice_item_forbidden_for_tenant quand la nature de ligne ne peut pas être facturée à ce destinataire.
     */
    public function assertItemAllowed(InvoiceItemSemantic $nature, bool $recipientIsMandant): void;

    public function requiresEInvoicing(PartyInvoiceData $recipient, CarbonImmutable $date): bool;

    /**
     * @param  list<TaxCategory>  $categories  catégories présentes sur la pièce
     * @return list<string>
     */
    public function mentions(VatRegime $regime, bool $vatOnDebits, array $categories, bool $recipientIsProfessional): array;
}
