<?php

declare(strict_types=1);

namespace App\Modules\Tax\Jurisdictions;

use App\Modules\Tax\Data\FormDefinition;

/**
 * Règles de la déclaration des revenus fonciers d'une juridiction (ADR 0008, 0039) : un formulaire par année de revenus, en données
 * revues et testées, jamais de condition sur le pays ni de repli sur l'année précédente.
 */
interface RentalIncomeRules
{
    public function jurisdiction(): string;

    public function currency(): string;

    /**
     * @return list<int>
     */
    public function supportedYears(): array;

    /**
     * Retourne null pour une année sans formulaire ; l'appelant refuse (422 `tax_year_unsupported`).
     */
    public function form(int $incomeYear): ?FormDefinition;

    /**
     * Le régime de bail relève-t-il de ce formulaire (location nue) ?
     */
    public function admitsLeaseRegime(string $regimeKey): bool;

    /**
     * @return list<string> natures de partie (`person`, `company`) dont la déclaration n'est pas celle d'un particulier
     */
    public function unsupportedTaxpayerKinds(): array;
}
