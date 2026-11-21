<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Support;

use App\Modules\Catalog\Enums\CertificateTypeSemantic;
use App\Modules\Catalog\Enums\ContactCategorySemantic;
use App\Modules\Catalog\Enums\ExpenseCategorySemantic;
use App\Modules\Catalog\Enums\InterventionNatureSemantic;
use App\Modules\Catalog\Enums\InvoiceItemSemantic;
use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Catalog\Enums\MandateTypeSemantic;
use App\Modules\Catalog\Enums\UnitTypeSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;

/**
 * Valeurs fournies par la plateforme (libellés français). Les durées des pièces sont des défauts indicatifs à vérifier
 * auprès des textes en vigueur avant mise en production.
 */
final class PlatformTerms
{
    /**
     * @return list<array{vocabulary: VocabularyKey, key: string, label: string, semantic: string|null, metadata: array<string, int|string|bool>}>
     */
    public static function all(): array
    {
        $lignes = [];

        foreach (self::definitions() as $vocabulaire => $valeurs) {
            foreach ($valeurs as $cle => $valeur) {
                [$libelle, $sens, $metadata] = $valeur + [1 => null, 2 => []];

                $lignes[] = [
                    'vocabulary' => VocabularyKey::from($vocabulaire),
                    'key' => $cle,
                    'label' => $libelle,
                    'semantic' => $sens,
                    'metadata' => $metadata,
                ];
            }
        }

        return $lignes;
    }

    /**
     * @return array<string, array<string, array{0: string, 1?: string|null, 2?: array<string, int|string|bool>}>>
     */
    private static function definitions(): array
    {
        $fr = ['country' => 'FR'];

        return [
            VocabularyKey::LegalForm->value => [
                'natural_person' => ['Personne physique'],
                'sci' => ['Société civile immobilière (SCI)', null, $fr],
                'sc' => ['Société civile (SC)', null, $fr],
                'sarl' => ['Société à responsabilité limitée (SARL)', null, $fr],
                'eurl' => ['Entreprise unipersonnelle à responsabilité limitée (EURL)', null, $fr],
                'sas' => ['Société par actions simplifiée (SAS)', null, $fr],
                'sasu' => ['Société par actions simplifiée unipersonnelle (SASU)', null, $fr],
                'sa' => ['Société anonyme (SA)', null, $fr],
                'snc' => ['Société en nom collectif (SNC)', null, $fr],
                'ei' => ['Entreprise individuelle (EI)', null, $fr],
                'association' => ['Association', null, $fr],
                'co_ownership_syndicate' => ['Syndicat des copropriétaires', null, $fr],
                'joint_ownership' => ['Indivision', null, $fr],
            ],
            VocabularyKey::ContactCategory->value => [
                'bailiff' => ['Commissaire de justice', ContactCategorySemantic::Bailiff->value],
                'craftsman' => ['Artisan', ContactCategorySemantic::Craftsman->value],
                'syndic' => ['Syndic', ContactCategorySemantic::Syndic->value],
                'insurer' => ['Assureur', ContactCategorySemantic::Insurer->value],
                'notary' => ['Notaire', ContactCategorySemantic::Notary->value],
                'accountant' => ['Expert-comptable', ContactCategorySemantic::Accountant->value],
                'other' => ['Autre', ContactCategorySemantic::Other->value],
            ],
            VocabularyKey::UnitType->value => [
                'apartment' => ['Appartement', UnitTypeSemantic::Residential->value],
                'house' => ['Maison', UnitTypeSemantic::Residential->value],
                'studio' => ['Studio', UnitTypeSemantic::Residential->value],
                'parking' => ['Parking', UnitTypeSemantic::Parking->value],
                'garage' => ['Garage', UnitTypeSemantic::Parking->value],
                'cellar' => ['Cave', UnitTypeSemantic::Storage->value],
                'commercial_premises' => ['Local commercial', UnitTypeSemantic::Commercial->value],
                'office' => ['Bureau', UnitTypeSemantic::Commercial->value],
                'land' => ['Terrain', UnitTypeSemantic::Land->value],
            ],
            VocabularyKey::LeaseComponent->value => [
                'rent' => ['Loyer', LeaseComponentSemantic::Rent->value],
                'charges_provision' => ['Provision sur charges', LeaseComponentSemantic::ChargesProvision->value],
                'charges_flat' => ['Charges forfaitaires', LeaseComponentSemantic::ChargesFlat->value],
                'rent_supplement' => ['Complément de loyer', LeaseComponentSemantic::RentSupplement->value],
                'deposit' => ['Dépôt de garantie', LeaseComponentSemantic::Deposit->value],
                'tax_recoverable' => ['Taxe récupérable', LeaseComponentSemantic::TaxRecoverable->value],
            ],
            VocabularyKey::CertificateType->value => [
                'energy_performance' => ['Diagnostic de performance énergétique (DPE)', CertificateTypeSemantic::EnergyPerformance->value, self::duree(120, 90) + ['data_schema' => [
                    'energy_class' => ['type' => 'string', 'required' => true, 'enum' => ['A', 'B', 'C', 'D', 'E', 'F', 'G']],
                    'ghg_class' => ['type' => 'string', 'enum' => ['A', 'B', 'C', 'D', 'E', 'F', 'G']],
                ]]],
                'electricity' => ['Diagnostic électricité', null, self::duree(72, 90)],
                'gas' => ['Diagnostic gaz', null, self::duree(72, 90)],
                'natural_risks' => ['État des risques', null, self::duree(6, 30)],
                'asbestos' => ['Diagnostic amiante'],
                'lead' => ['Constat de risque d\'exposition au plomb'],
                'boiler_service' => ['Entretien de la chaudière', null, self::duree(12, 30)],
                'elevator_inspection' => ['Contrôle de l\'ascenseur', null, self::duree(60, 90)],
                'professional_card' => ['Carte professionnelle', CertificateTypeSemantic::ProfessionalCard->value, self::duree(36, 90)],
                'financial_guarantee' => ['Garantie financière', CertificateTypeSemantic::FinancialGuarantee->value, self::duree(12, 60) + ['data_schema' => [
                    'guaranteed_amount' => ['type' => 'integer', 'required' => true, 'min' => 0],
                ]]],
                'professional_liability' => ['Responsabilité civile professionnelle', CertificateTypeSemantic::ProfessionalLiability->value, self::duree(12, 60)],
                'home_insurance' => ['Assurance habitation du locataire', CertificateTypeSemantic::HomeInsurance->value, self::duree(12, 30)],
            ],
            VocabularyKey::ExpenseCategory->value => [
                'maintenance' => ['Entretien', ExpenseCategorySemantic::Maintenance->value, self::recuperable(true)],
                'repairs' => ['Réparations', ExpenseCategorySemantic::Repairs->value, self::recuperable(false)],
                'improvements' => ['Travaux d\'amélioration', ExpenseCategorySemantic::Improvements->value, self::recuperable(false)],
                'insurance' => ['Assurance', ExpenseCategorySemantic::Insurance->value, self::recuperable(false)],
                'property_tax' => ['Taxe foncière', ExpenseCategorySemantic::PropertyTax->value, self::recuperable(true)],
                'management_fees' => ['Frais de gestion', ExpenseCategorySemantic::ManagementFees->value, self::recuperable(false)],
                'loan_interest' => ['Intérêts d\'emprunt', ExpenseCategorySemantic::LoanInterest->value, self::recuperable(false)],
                'utilities' => ['Eau, énergie et services', ExpenseCategorySemantic::Utilities->value, self::recuperable(true)],
                'co_ownership' => ['Charges de copropriété', ExpenseCategorySemantic::CoOwnership->value, self::recuperable(true)],
                'other' => ['Autres dépenses', ExpenseCategorySemantic::Other->value, self::recuperable(false)],
            ],
            VocabularyKey::ChargeRubric->value => [
                'elevators' => ['Ascenseurs et monte-charge'],
                'water_heating' => ['Eau froide, eau chaude et chauffage collectif'],
                'individual_installations' => ['Installations individuelles'],
                'common_interior' => ['Parties communes intérieures'],
                'outdoor_spaces' => ['Espaces extérieurs'],
                'hygiene' => ['Hygiène'],
                'building_equipment' => ['Équipements divers du bâtiment'],
                'taxes_and_fees' => ['Impositions et redevances'],
            ],
            VocabularyKey::MandateType->value => [
                'rental_management' => ['Gestion locative', MandateTypeSemantic::RentalManagement->value],
                'rental_management_syndic' => ['Gestion locative et syndic', MandateTypeSemantic::ManagementWithSyndic->value],
                'short_term_management' => ['Gestion de location saisonnière', MandateTypeSemantic::ShortTermManagement->value],
                'tenant_search' => ['Recherche de locataire', MandateTypeSemantic::TenantSearch->value],
                'other' => ['Autre mandat', MandateTypeSemantic::Other->value],
            ],
            VocabularyKey::InvoiceItem->value => [
                'management_fee' => ['Honoraires de gestion', InvoiceItemSemantic::FeeManagement->value],
                'letting_fee' => ['Honoraires de location', InvoiceItemSemantic::FeeLetting->value],
                'other_fee' => ['Autres honoraires', InvoiceItemSemantic::FeeOther->value],
                'service' => ['Prestation de services', InvoiceItemSemantic::Service->value],
                'recovery_cost' => ['Frais d\'acte de recouvrement refacturés au mandant', InvoiceItemSemantic::RecoveryCost->value],
            ],
            VocabularyKey::InterventionNature->value => [
                'plumbing' => ['Plomberie', InterventionNatureSemantic::Plumbing->value, self::nature(false, true, 'owner', ExpenseCategorySemantic::Repairs)],
                'electrical' => ['Électricité', InterventionNatureSemantic::Electrical->value, self::nature(false, true, 'owner', ExpenseCategorySemantic::Repairs)],
                'heating' => ['Chauffage', InterventionNatureSemantic::Heating->value, self::nature(true, true, 'shared', ExpenseCategorySemantic::Maintenance)],
                'locksmith' => ['Serrurerie', InterventionNatureSemantic::Locksmith->value, self::nature(true, false, 'undetermined', ExpenseCategorySemantic::Repairs)],
                'humidity' => ['Humidité', InterventionNatureSemantic::Humidity->value, self::nature(false, false, 'owner', ExpenseCategorySemantic::Repairs)],
                'pests' => ['Nuisibles', InterventionNatureSemantic::Pests->value, self::nature(false, false, 'undetermined', ExpenseCategorySemantic::Maintenance)],
                'other' => ['Autre', InterventionNatureSemantic::Other->value, self::nature(false, false, 'undetermined', ExpenseCategorySemantic::Other)],
            ],
            VocabularyKey::TaxRate->value => [
                'fr_vat_normal' => ['TVA 20 %', null, self::taux('FR', 'S', 20000)],
                'fr_vat_intermediate' => ['TVA 10 %', null, self::taux('FR', 'S', 10000)],
                'fr_vat_reduced' => ['TVA 5,5 %', null, self::taux('FR', 'S', 5500)],
                'fr_vat_super_reduced' => ['TVA 2,1 %', null, self::taux('FR', 'S', 2100)],
                'fr_vat_zero' => ['TVA à taux zéro', null, self::taux('FR', 'Z', 0)],
                'fr_vat_exempt' => ['Exonéré de TVA', null, self::taux('FR', 'E', 0)],
                'fr_vat_reverse_charge' => ['Autoliquidation de la TVA', null, self::taux('FR', 'AE', 0)],
                'fr_vat_outside_scope' => ['Hors champ de la TVA', null, self::taux('FR', 'O', 0)],
            ],
        ];
    }

    /**
     * Taux de TVA français, en cent-millièmes (100 000 = 100 %) ; la date d'entrée en vigueur est à confirmer sur impots.gouv.fr.
     *
     * @return array<string, int|string|bool>
     */
    private static function taux(string $pays, string $categorie, int $tauxPcm): array
    {
        return ['country' => $pays, 'tax_code' => 'vat', 'category' => $categorie, 'rate_pcm' => $tauxPcm, 'effective_from' => '2014-01-01'];
    }

    /**
     * Indication de saisie seulement : la part récupérable d'une dépense reste décidée par l'équipe, dans la limite des rubriques de la juridiction.
     *
     * @return array<string, bool>
     */
    private static function recuperable(bool $valeur): array
    {
        return ['recoverable_by_default' => $valeur];
    }

    /**
     * Défauts indicatifs de nature d'intervention : l'imputation au locataire reste décidée par l'équipe et les règles de la juridiction.
     *
     * @return array<string, bool|string>
     */
    private static function nature(bool $locataire, bool $assurance, string $responsabilite, ExpenseCategorySemantic $depense): array
    {
        return ['tenant_chargeable' => $locataire, 'insurance_required' => $assurance, 'default_responsibility' => $responsabilite, 'expense_semantic' => $depense->value];
    }

    /**
     * @return array<string, mixed>
     */
    private static function duree(int $mois, int $rappelJours): array
    {
        return ['default_validity_months' => $mois, 'reminder_days' => $rappelJours];
    }
}
