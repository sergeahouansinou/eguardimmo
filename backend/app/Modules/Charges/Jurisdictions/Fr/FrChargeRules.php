<?php

declare(strict_types=1);

namespace App\Modules\Charges\Jurisdictions\Fr;

use App\Modules\Catalog\Enums\ExpenseCategorySemantic;
use App\Modules\Charges\Jurisdictions\ChargeRules;
use Carbon\CarbonImmutable;

/**
 * Loi n° 89-462 du 6 juillet 1989, art. 23 et 7-1 ; décret n° 87-713 du 26 août 1987. Valeurs datées à confirmer par un juriste
 * avant la mise en production (ADR 0034, points à valider 1 à 7).
 */
final class FrChargeRules implements ChargeRules
{
    private const array RUBRIQUES = ['elevators', 'water_heating', 'individual_installations', 'common_interior', 'outdoor_spaces', 'hygiene', 'building_equipment', 'taxes_and_fees'];

    private const array DELAI_EXIGIBILITE = [['2015-01-01', 1]];

    private const array DISPONIBILITE_PIECES = [['2015-01-01', 6]];

    private const array PRESCRIPTION = [['2015-01-01', 3]];

    public function jurisdiction(): string
    {
        return 'FR';
    }

    public function templateVersion(): string
    {
        return 'DC-1';
    }

    public function recoverableRubrics(): array
    {
        return self::RUBRIQUES;
    }

    public function nonRecoverableCategories(): array
    {
        return [
            ExpenseCategorySemantic::ManagementFees->value,
            ExpenseCategorySemantic::Insurance->value,
            ExpenseCategorySemantic::LoanInterest->value,
            ExpenseCategorySemantic::Improvements->value,
        ];
    }

    public function admitsRegime(string $regimeKey): bool
    {
        return str_starts_with($regimeKey, 'fr.residential.');
    }

    public function dueDelayMonths(CarbonImmutable $at): int
    {
        return $this->dated(self::DELAI_EXIGIBILITE, $at);
    }

    public function isLate(CarbonImmutable $periodEndExclusive, CarbonImmutable $issuedOn): bool
    {
        $derniereJournee = $periodEndExclusive->subDay();

        return $issuedOn->greaterThan($derniereJournee->addYear()->endOfYear());
    }

    public function documentAvailabilityMonths(CarbonImmutable $at): int
    {
        return $this->dated(self::DISPONIBILITE_PIECES, $at);
    }

    public function prescriptionYears(CarbonImmutable $at): int
    {
        return $this->dated(self::PRESCRIPTION, $at);
    }

    public function mentions(CarbonImmutable $at): array
    {
        return [
            'Décompte établi en application de l\'article 23 de la loi n° 89-462 du 6 juillet 1989 : les charges récupérables sont celles de la liste fixée par le décret n° 87-713 du 26 août 1987.',
            "Les pièces justificatives sont tenues à disposition du locataire pendant {$this->documentAvailabilityMonths($at)} mois à compter de l'envoi du présent décompte.",
            'Le solde est exigible un mois après l\'envoi du décompte ; au-delà de la fin de l\'année civile qui suit, le locataire peut demander à le payer par douzièmes sur douze mois.',
        ];
    }

    /**
     * @param  list<array{string, int}>  $valeurs  date d'entrée en vigueur, valeur ; la dernière entrée en vigueur à la date donnée fait foi
     */
    private function dated(array $valeurs, CarbonImmutable $at): int
    {
        $retenue = $valeurs[0][1];

        foreach ($valeurs as [$depuis, $valeur]) {
            if ($at->toDateString() >= $depuis) {
                $retenue = $valeur;
            }
        }

        return $retenue;
    }
}
