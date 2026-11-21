<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Support;

use App\Modules\Invoicing\Enums\TaxCategory;
use App\Modules\Invoicing\Jurisdictions\InvoiceTaxRules;
use App\Modules\Invoicing\Models\Invoice;
use App\Modules\Organizations\Data\LegalIdentityData;
use App\Modules\Parties\Data\PartyInvoiceData;
use App\Modules\Parties\Enums\PartyKind;
use Carbon\CarbonImmutable;

/**
 * Instantané d'une pièce émise (ADR 0022) : émetteur, destinataire, références, lignes, taxes et mentions sont copiés ici
 * à l'émission ; la pièce ne relit jamais une fiche ensuite.
 */
final class Snapshots
{
    /**
     * @param  Invoice|null  $origine  facture d'origine, pour un avoir
     * @return array<string, mixed>
     */
    public function build(
        Invoice $facture,
        string $numero,
        PricedInvoice $chiffree,
        LegalIdentityData $emetteur,
        PartyInvoiceData $destinataire,
        ReferenceContext $references,
        InvoiceTaxRules $regles,
        string $role,
        bool $tvaDifferee,
        CarbonImmutable $jour,
        ?Invoice $origine,
    ): array {
        $categories = array_values(array_unique(array_map(fn (TaxGroup $g): TaxCategory => $g->category, $chiffree->taxes), SORT_REGULAR));

        return [
            'kind' => $facture->kind->value,
            'number' => $numero,
            'issued_on' => $jour->toDateString(),
            'due_on' => $facture->due_on?->toDateString(),
            'service' => ['from' => $facture->service_from?->toDateString(), 'to' => $facture->service_to?->toDateString()],
            'template_version' => $regles->templateVersion(),
            'jurisdiction' => $facture->jurisdiction,
            'currency' => $chiffree->currency,
            'issuer' => [
                'organization_id' => $emetteur->organizationId,
                'name' => $emetteur->legalName,
                'legal_name' => $emetteur->legalName,
                'address' => $emetteur->address,
                'siren' => $emetteur->siren,
                'siret' => $emetteur->siret,
                'vat_number' => $emetteur->vatNumber,
                'legal_form' => $emetteur->legalForm,
                'share_capital' => $emetteur->shareCapital,
                'registry_city' => $emetteur->registryCity,
                'professional_card_number' => $emetteur->professionalCardNumber,
                'professional_card_issuer' => $emetteur->professionalCardIssuer,
                'guarantee_provider' => $emetteur->guaranteeProvider,
                'guarantee_amount' => $emetteur->guaranteeAmount,
                'vat_regime' => $emetteur->vatRegime->value,
                'vat_on_debits' => $emetteur->vatOnDebits,
            ],
            'recipient' => [
                'party_id' => $destinataire->id,
                'name' => $destinataire->displayName,
                'kind' => $destinataire->kind->value,
                'address' => $destinataire->address,
                'siren' => $destinataire->siren,
                'siret' => $destinataire->siret,
                'vat_number' => $destinataire->vatNumber,
            ],
            'references' => [
                'lease' => $facture->lease_id === null ? null : ['id' => $facture->lease_id, 'reference' => $references->leaseReference],
                'mandate' => $facture->mandate_id === null ? null : ['id' => $facture->mandate_id, 'reference' => $references->mandateReference],
                'credited_invoice' => $origine === null ? null : ['id' => $origine->id, 'number' => $origine->number, 'issued_on' => $origine->issued_on?->toDateString()],
            ],
            'lines' => array_map(fn (PricedLine $l, int $i): array => [
                'position' => $i + 1,
                'description' => $l->line->description,
                'item' => $l->line->semantic->value,
                'quantity_milli' => $l->line->quantityMilli,
                'unit_price' => $l->line->unitPrice,
                'net_amount' => $l->net,
                'tax_category' => $l->rate->category->value,
                'tax_rate_pcm' => $l->rate->ratePcm,
            ], $chiffree->lines, array_keys($chiffree->lines)),
            'taxes' => array_map(fn (TaxGroup $g): array => [
                'tax_code' => $g->code->value,
                'category' => $g->category->value,
                'rate_pcm' => $g->ratePcm,
                'base_amount' => $g->base,
                'tax_amount' => $g->tax,
            ], $chiffree->taxes),
            'amounts' => ['net' => $chiffree->net, 'tax' => $chiffree->tax, 'gross' => $chiffree->gross()],
            'credit_reason' => $facture->credit_reason,
            'mentions' => $regles->mentions($emetteur->vatRegime, $emetteur->vatOnDebits, $categories, $destinataire->kind === PartyKind::Company),
            'ledger' => ['receivable_account' => $role, 'vat_deferred' => $tvaDifferee],
        ];
    }
}
