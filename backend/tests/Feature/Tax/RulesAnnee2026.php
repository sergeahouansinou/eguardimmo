<?php

declare(strict_types=1);

namespace Tests\Feature\Tax;

use App\Modules\Tax\Data\FormDefinition;
use App\Modules\Tax\Jurisdictions\Fr\FrRentalIncomeRules;
use App\Modules\Tax\Jurisdictions\Fr\Millesimes\Revenus2025;
use App\Modules\Tax\Jurisdictions\RentalIncomeRules;
use App\Modules\Tax\Jurisdictions\RentalIncomeRulesRegistry;

/**
 * Règles françaises dont l'année 2026 reprend le formulaire 2025 : les scénarios d'agence du dépôt vivent en 2026, un millésime 2026
 * n'existe pas encore. Ne sert qu'à ces tests. Points fiscaux à valider par l'expert-comptable : ADR 0039, amendement du 2026-11-21 (points 11 à 15) ; les valeurs de référence des tests ne les tranchent pas.
 */
final class RulesAnnee2026 implements RentalIncomeRules
{
    private FrRentalIncomeRules $base;

    public function __construct()
    {
        $this->base = new FrRentalIncomeRules;
    }

    public static function installer(): void
    {
        app()->instance(RentalIncomeRulesRegistry::class, new RentalIncomeRulesRegistry([new self]));
    }

    public function jurisdiction(): string
    {
        return $this->base->jurisdiction();
    }

    public function currency(): string
    {
        return $this->base->currency();
    }

    public function supportedYears(): array
    {
        return [2025, 2026];
    }

    public function form(int $incomeYear): ?FormDefinition
    {
        if ($incomeYear !== 2026) {
            return $this->base->form($incomeYear);
        }

        $f = (new Revenus2025)->form();

        return new FormDefinition(
            $f->jurisdiction, 2026, 'fr-2044-2026-test', $f->templateVersion, $f->currency, $f->lines, $f->categoryLines, $f->totals, $f->minorPerMajor,
            $f->flatFeePerPremises, $f->microThreshold, $f->microAllowanceBp, $f->deficitCeiling, $f->warning, $f->mentions,
        );
    }

    public function admitsLeaseRegime(string $regimeKey): bool
    {
        return $this->base->admitsLeaseRegime($regimeKey);
    }

    public function unsupportedTaxpayerKinds(): array
    {
        return $this->base->unsupportedTaxpayerKinds();
    }
}
