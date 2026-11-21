<?php

declare(strict_types=1);

namespace App\Modules\Tax\Jurisdictions\Fr\Millesimes;

use App\Modules\Catalog\Enums\ExpenseCategorySemantic;
use App\Modules\Tax\Data\FormDefinition;
use App\Modules\Tax\Data\FormLineData;

/**
 * Formulaire n° 2044 (cerfa 50156), revenus 2025, lu sur impots.gouv.fr (formulaire et notice) : libellés, formules des totaux et sens de
 * signe de la ligne 230 à confirmer par un expert-comptable avant la mise en production (ADR 0039, points à valider 1 à 7 et amendement du 2026-11-21, points 11 à 15 : partage du déficit entre intérêts et autres charges, assurance emprunteur en différé total, ligne 224 « améliorations », ligne 211 du mandant, plafond de rénovation énergétique et ligne 230).
 * Aucun calcul ne change sans cas de référence fourni par un expert-comptable.
 * Montants en centimes d'euro.
 */
final class Revenus2025
{
    public function form(): FormDefinition
    {
        $calculee = FormLineData::COMPUTED;
        $saisie = FormLineData::TO_COMPLETE;
        $total = FormLineData::TOTAL;

        return new FormDefinition(
            jurisdiction: 'FR',
            incomeYear: 2025,
            version: 'fr-2044-2025',
            templateVersion: 'TAX-2044-1',
            currency: 'EUR',
            lines: [
                new FormLineData('211', 'Loyers bruts encaissés dans l\'année (y compris arriérés et avances)', $calculee),
                new FormLineData('212', 'Ligne 212', $saisie),
                new FormLineData('213', 'Ligne 213', $saisie),
                new FormLineData('214', 'Ligne 214', $saisie),
                new FormLineData('215', 'Total des recettes', $total),
                new FormLineData('221', 'Frais d\'administration et de gestion (honoraires)', $calculee),
                new FormLineData('222', 'Forfait de frais de gestion (20 € par local)', $calculee),
                new FormLineData('223', 'Primes d\'assurance', $calculee),
                new FormLineData('224', 'Dépenses de réparation, d\'entretien et d\'amélioration', $calculee),
                new FormLineData('224bis', 'Ligne 224 bis (travaux de rénovation énergétique)', $saisie),
                new FormLineData('225', 'Ligne 225', $saisie),
                new FormLineData('226', 'Ligne 226', $saisie),
                new FormLineData('227', 'Taxes foncières payées dans l\'année (hors taxe d\'enlèvement des ordures ménagères)', $calculee),
                new FormLineData('228', 'Ligne 228', $saisie),
                new FormLineData('229', 'Provisions pour charges de copropriété payées dans l\'année', $calculee),
                new FormLineData('230', 'Régularisation des provisions pour charges déduites l\'année précédente', $calculee),
                new FormLineData('240', 'Total des frais et charges', $total),
                new FormLineData('250', 'Intérêts d\'emprunt et frais d\'emprunt', $calculee),
                new FormLineData('261', 'Total des frais, charges et intérêts d\'emprunt', $total),
                new FormLineData('263', 'Revenu foncier net ou déficit', $total),
            ],
            categoryLines: [
                ExpenseCategorySemantic::ManagementFees->value => '221',
                ExpenseCategorySemantic::Insurance->value => '223',
                ExpenseCategorySemantic::Maintenance->value => '224',
                ExpenseCategorySemantic::Repairs->value => '224',
                ExpenseCategorySemantic::Improvements->value => '224',
                ExpenseCategorySemantic::PropertyTax->value => '227',
                ExpenseCategorySemantic::CoOwnership->value => '229',
                ExpenseCategorySemantic::LoanInterest->value => '250',
            ],
            totals: [
                '215' => ['plus' => ['211', '212', '213', '214'], 'minus' => []],
                '240' => ['plus' => ['221', '222', '223', '224', '224bis', '225', '226', '227', '228', '229'], 'minus' => ['230']],
                '261' => ['plus' => ['240', '250'], 'minus' => []],
                '263' => ['plus' => ['215'], 'minus' => ['261']],
            ],
            minorPerMajor: 100,
            flatFeePerPremises: 2000,
            microThreshold: 1500000,
            microAllowanceBp: 3000,
            deficitCeiling: 1070000,
            warning: 'Montants à reporter sur votre déclaration, sans centimes. Cette synthèse est une aide au calcul : elle ne choisit pas votre régime d\'imposition, ne remplace pas le conseil d\'un expert-comptable et ne dépose rien auprès de l\'administration.',
            mentions: [
                'Loyers encaissés dans l\'année, y compris arriérés et avances ; dépenses payées dans l\'année.',
                'Les lignes marquées « à compléter » ne sont pas calculées : saisissez-les si vous êtes concerné.',
                'Montants à 100 % du bien : répartissez-les selon vos droits en cas de propriété partagée.',
            ],
        );
    }

    public function incomeYear(): int
    {
        return $this->form()->incomeYear;
    }
}
