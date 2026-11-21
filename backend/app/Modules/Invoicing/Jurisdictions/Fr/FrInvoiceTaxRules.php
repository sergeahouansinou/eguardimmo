<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Jurisdictions\Fr;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\InvoiceItemSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Invoicing\Enums\ErrorCode;
use App\Modules\Invoicing\Enums\TaxCategory;
use App\Modules\Invoicing\Enums\TaxCode;
use App\Modules\Invoicing\Jurisdictions\InvoiceTaxRules;
use App\Modules\Invoicing\Jurisdictions\ResolvedRate;
use App\Modules\Organizations\Enums\VatRegime;
use App\Modules\Parties\Data\PartyInvoiceData;
use App\Modules\Parties\Enums\PartyKind;
use Carbon\CarbonImmutable;

/**
 * CGI annexe II art. 242 nonies A (mentions), CGI art. 293 B (franchise), CGI art. 269 (exigibilité des services),
 * Code de commerce L441-9 et D441-5 (pénalités et indemnité de recouvrement), loi n° 89-462 art. 4 p (frais interdits
 * au locataire). Sources secondaires : formules et dates à faire valider avant la mise en production (ADR 0011).
 */
final readonly class FrInvoiceTaxRules implements InvoiceTaxRules
{
    public function __construct(private TermDirectory $termes) {}

    public function jurisdiction(): string
    {
        return 'FR';
    }

    public function currency(): string
    {
        return 'EUR';
    }

    public function templateVersion(): string
    {
        return 'fr-2026-11';
    }

    public function effectiveCategory(VatRegime $regime, TaxCategory $demandee): TaxCategory
    {
        return $regime === VatRegime::Franchise ? TaxCategory::OutsideScope : $demandee;
    }

    public function rate(TaxCategory $category, ?string $rateKey, CarbonImmutable $date): ResolvedRate
    {
        $jour = $date->toDateString();
        $candidats = array_values(array_filter(
            $this->termes->list(VocabularyKey::TaxRate),
            fn (TermData $terme): bool => ($terme->metadata['country'] ?? null) === 'FR'
                && ($terme->metadata['tax_code'] ?? null) === TaxCode::Vat->value
                && ($terme->metadata['category'] ?? null) === $category->value
                && ($rateKey === null || $terme->key === $rateKey)
                && is_string($terme->metadata['effective_from'] ?? null) && $terme->metadata['effective_from'] <= $jour
                && (! is_string($terme->metadata['effective_to'] ?? null) || $terme->metadata['effective_to'] >= $jour),
        ));

        if (count($candidats) !== 1 || ! is_int($candidats[0]->metadata['rate_pcm'] ?? null)) {
            throw ErrorCode::TaxRateUnknown->problem();
        }

        return new ResolvedRate(TaxCode::Vat, $category, $candidats[0]->metadata['rate_pcm'], $candidats[0]->key);
    }

    public function assertRateAllowed(VatRegime $regime, InvoiceItemSemantic $nature, ResolvedRate $taux, bool $recipientIsVatRegisteredCompany): void
    {
        $autorise = match ($taux->category) {
            TaxCategory::OutsideScope => $regime === VatRegime::Franchise,
            TaxCategory::ReverseCharge => $regime === VatRegime::Normal && $recipientIsVatRegisteredCompany,
            TaxCategory::Exempt => $regime === VatRegime::Normal && $nature === InvoiceItemSemantic::Service,
            TaxCategory::Standard => $regime === VatRegime::Normal && in_array($taux->key, $this->standardKeysFor($nature), true),
            default => false,
        };

        if (! $autorise) {
            throw ErrorCode::TaxRateNotAllowed->problem();
        }
    }

    /**
     * Honoraires et frais : taux normal seul. Seule une prestation de service (travaux ou entretien du logement) peut
     * relever du taux intermédiaire ou réduit ; le taux super réduit ne concerne aucune ligne de cette facturation.
     *
     * @return list<string>
     */
    private function standardKeysFor(InvoiceItemSemantic $nature): array
    {
        return $nature === InvoiceItemSemantic::Service
            ? ['fr_vat_normal', 'fr_vat_intermediate', 'fr_vat_reduced']
            : ['fr_vat_normal'];
    }

    public function managementFeeRateKey(): string
    {
        return 'fr_vat_normal';
    }

    public function isVatDeferred(bool $vatOnDebits): bool
    {
        return ! $vatOnDebits;
    }

    public function assertItemAllowed(InvoiceItemSemantic $nature, bool $recipientIsMandant): void
    {
        if ($nature === InvoiceItemSemantic::RecoveryCost && ! $recipientIsMandant) {
            throw ErrorCode::ItemForbiddenForTenant->problem();
        }
    }

    public function requiresEInvoicing(PartyInvoiceData $recipient, CarbonImmutable $date): bool
    {
        $depuis = config('invoicing.e_invoicing.FR.from');

        return $recipient->kind === PartyKind::Company
            && $recipient->siren !== null
            && ($recipient->address['country'] ?? 'FR') === 'FR'
            && is_string($depuis) && $depuis !== '' && $date->toDateString() >= $depuis;
    }

    public function mentions(VatRegime $regime, bool $vatOnDebits, array $categories, bool $recipientIsProfessional): array
    {
        $mentions = [];

        if ($regime === VatRegime::Franchise) {
            $mentions[] = 'TVA non applicable, art. 293 B du CGI';
        }

        if (in_array(TaxCategory::ReverseCharge, $categories, true)) {
            $mentions[] = 'Autoliquidation de la TVA par le preneur';
        }

        if (in_array(TaxCategory::Exempt, $categories, true)) {
            $mentions[] = 'Opération exonérée de TVA';
        }

        if ($regime === VatRegime::Normal && $vatOnDebits) {
            $mentions[] = 'TVA acquittée sur les débits';
        }

        $mentions[] = 'Prestation de services ; la TVA est exigible à l\'encaissement, sauf option pour les débits.';
        $mentions[] = 'Pénalités de retard : trois fois le taux d\'intérêt légal, exigibles sans rappel (art. L441-10 du Code de commerce).';

        if ($recipientIsProfessional) {
            $mentions[] = 'Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 € (art. D441-5 du Code de commerce).';
        }

        $mentions[] = 'Pas d\'escompte pour paiement anticipé.';

        return $mentions;
    }
}
