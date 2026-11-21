<?php

declare(strict_types=1);

namespace App\Modules\Investments\PublicApi;

use App\Modules\Investments\Data\LoanCostData;
use App\Modules\Investments\Data\LoanInstallmentData;
use App\Modules\Investments\Queries\LoanFacts;
use Carbon\CarbonImmutable;

/**
 * Coût des prêts de l'organisation courante, informatif : aucune écriture au grand livre (ADR 0039).
 */
final readonly class LoanCosts
{
    public function __construct(private LoanFacts $faits) {}

    /**
     * Intérêts payés, assurance et frais de l'année : l'attestation de la banque si elle existe, sinon l'échéancier et les frais saisis.
     *
     * @param  list<string>|null  $propertyIds  null : tous les biens ; liste vide : aucun
     * @return list<LoanCostData>
     */
    public function deductible(int $year, ?array $propertyIds = null): array
    {
        return $this->faits->deductible($year, $propertyIds);
    }

    /**
     * @return list<string> biens qui ont un prêt suivi (attestation, échéance ou frais) pour l'année
     */
    public function trackedProperties(int $year): array
    {
        return $this->faits->trackedProperties($year);
    }

    /**
     * Échéances (assurance à part) dont la date est dans [from, toExclusive).
     *
     * @param  list<string>|null  $propertyIds
     * @return list<LoanInstallmentData>
     */
    public function installments(CarbonImmutable $from, CarbonImmutable $toExclusive, ?array $propertyIds = null): array
    {
        return $this->faits->installments($from, $toExclusive, $propertyIds);
    }

    /**
     * Marque ces prêts comme utilisés par une synthèse fiscale figée : leur annulation est alors refusée.
     *
     * @param  list<string>  $loanIds
     */
    public function markUsed(array $loanIds, int $year): void
    {
        $this->faits->markUsed($loanIds, $year);
    }
}
