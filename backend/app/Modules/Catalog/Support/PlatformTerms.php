<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Support;

use App\Modules\Catalog\Enums\CertificateTypeSemantic;
use App\Modules\Catalog\Enums\ContactCategorySemantic;
use App\Modules\Catalog\Enums\ExpenseCategorySemantic;
use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Catalog\Enums\UnitTypeSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;

/**
 * Valeurs fournies par la plateforme (libellés français). Les durées des pièces sont des défauts indicatifs à vérifier
 * auprès des textes en vigueur avant mise en production.
 */
final class PlatformTerms
{
    /**
     * @return list<array{vocabulary: VocabularyKey, key: string, label: string, semantic: string|null, metadata: array<string, int|string>}>
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
     * @return array<string, array<string, array{0: string, 1?: string|null, 2?: array<string, int|string>}>>
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
                'home_insurance' => ['Assurance habitation du locataire', null, self::duree(12, 30)],
            ],
            VocabularyKey::ExpenseCategory->value => [
                'maintenance' => ['Entretien', ExpenseCategorySemantic::Maintenance->value],
                'repairs' => ['Réparations', ExpenseCategorySemantic::Repairs->value],
                'improvements' => ['Travaux d\'amélioration', ExpenseCategorySemantic::Improvements->value],
                'insurance' => ['Assurance', ExpenseCategorySemantic::Insurance->value],
                'property_tax' => ['Taxe foncière', ExpenseCategorySemantic::PropertyTax->value],
                'management_fees' => ['Frais de gestion', ExpenseCategorySemantic::ManagementFees->value],
                'loan_interest' => ['Intérêts d\'emprunt', ExpenseCategorySemantic::LoanInterest->value],
                'utilities' => ['Eau, énergie et services', ExpenseCategorySemantic::Utilities->value],
                'co_ownership' => ['Charges de copropriété', ExpenseCategorySemantic::CoOwnership->value],
                'other' => ['Autres dépenses', ExpenseCategorySemantic::Other->value],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function duree(int $mois, int $rappelJours): array
    {
        return ['default_validity_months' => $mois, 'reminder_days' => $rappelJours];
    }
}
