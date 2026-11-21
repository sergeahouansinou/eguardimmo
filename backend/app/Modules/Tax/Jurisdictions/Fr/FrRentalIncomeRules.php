<?php

declare(strict_types=1);

namespace App\Modules\Tax\Jurisdictions\Fr;

use App\Modules\Tax\Data\FormDefinition;
use App\Modules\Tax\Jurisdictions\Fr\Millesimes\Revenus2025;
use App\Modules\Tax\Jurisdictions\RentalIncomeRules;

/**
 * Revenus fonciers de la location nue, déclaration n° 2044 (régime réel normal). Le millésime de chaque année de revenus est une
 * classe de `Millesimes/` ajoutée après lecture du formulaire officiel.
 */
final class FrRentalIncomeRules implements RentalIncomeRules
{
    private const string REGIME_LOCATION_NUE = 'fr.residential.unfurnished';

    /** @var array<int, FormDefinition> */
    private array $formulaires;

    public function __construct()
    {
        $formulaires = [];

        foreach ([new Revenus2025] as $millesime) {
            $formulaire = $millesime->form();
            $formulaires[$formulaire->incomeYear] = $formulaire;
        }

        $this->formulaires = $formulaires;
    }

    public function jurisdiction(): string
    {
        return 'FR';
    }

    public function currency(): string
    {
        return 'EUR';
    }

    public function supportedYears(): array
    {
        return array_keys($this->formulaires);
    }

    public function form(int $incomeYear): ?FormDefinition
    {
        return $this->formulaires[$incomeYear] ?? null;
    }

    public function admitsLeaseRegime(string $regimeKey): bool
    {
        return $regimeKey === self::REGIME_LOCATION_NUE;
    }

    public function unsupportedTaxpayerKinds(): array
    {
        return ['company'];
    }
}
