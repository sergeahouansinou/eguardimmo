<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Finance;

use App\Modules\Accounting\Enums\CollectionComponent;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Catalog\Enums\ExpenseCategorySemantic;
use App\Modules\Investments\PublicApi\LoanCosts;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Faits d'une année civile par bien et par lot : loyers encaissés hors charges, dépenses payées non récupérées hors intérêts, financement
 * (intérêts, assurance, frais). Un fait sans lot (`unit_id` nul) est rattaché au bien seul.
 */
final readonly class ProfitabilityFigures
{
    public function __construct(private LedgerAggregates $grandLivre, private ExpenseRecords $depenses, private LoanCosts $prets) {}

    /**
     * @return array{
     *     rent: array<string, int>,
     *     expenses: array<string, int>,
     *     financing: array<string, array{interest: int, insurance: int, fees: int}>,
     *     unattributed: int
     * } clés `bien|lot` ; `unattributed` : dépenses sans bien connu
     */
    public function of(int $year, Currency $devise): array
    {
        $debut = CarbonImmutable::createFromDate($year, 1, 1)->startOfDay();
        $fin = $debut->addYear();
        $loyers = [];
        $unites = [];

        foreach ($this->grandLivre->collectedByComponent($devise, $debut, $fin->subDay()) as $c) {
            if ($c->component === CollectionComponent::Rent && $c->unitId !== null) {
                $unites[$c->unitId] = true;
                $loyers[$c->unitId] = ($loyers[$c->unitId] ?? 0) + Amounts::minor($c->amount);
            }
        }

        $enregistrements = $this->depenses->between($debut, $fin, $devise);
        $suivis = array_flip($this->prets->trackedProperties($year));
        $couts = $this->prets->deductible($year);

        foreach ([...$enregistrements, ...$couts] as $fait) {
            $fait->unitId === null || $unites[$fait->unitId] = true;
        }

        $biens = $this->depenses->propertiesOfUnits(array_keys($unites));
        $sortie = ['rent' => [], 'expenses' => [], 'financing' => [], 'unattributed' => 0];

        foreach ($loyers as $lot => $montant) {
            $sortie['rent'][$biens[$lot].'|'.$lot] = $montant;
        }

        foreach ($enregistrements as $e) {
            if ($e->propertyId === null) {
                $sortie['unattributed'] += $e->amount;

                continue;
            }

            $cle = $e->propertyId.'|'.($e->unitId ?? '');

            if ($e->semantic === ExpenseCategorySemantic::LoanInterest->value) {
                isset($suivis[$e->propertyId]) || $sortie['financing'][$cle] = $this->plus($sortie['financing'][$cle] ?? null, $e->amount, 0, 0);

                continue;
            }

            $sortie['expenses'][$cle] = ($sortie['expenses'][$cle] ?? 0) + $e->amount;
        }

        foreach ($couts as $c) {
            $cle = $c->propertyId.'|'.($c->unitId ?? '');
            $sortie['financing'][$cle] = $this->plus($sortie['financing'][$cle] ?? null, Amounts::minor($c->interest), Amounts::minor($c->insurance), Amounts::minor($c->fees));
        }

        return $sortie;
    }

    /**
     * @param  array{interest: int, insurance: int, fees: int}|null  $courant
     * @return array{interest: int, insurance: int, fees: int}
     */
    private function plus(?array $courant, int $interets, int $assurance, int $frais): array
    {
        return ['interest' => ($courant['interest'] ?? 0) + $interets, 'insurance' => ($courant['insurance'] ?? 0) + $assurance, 'fees' => ($courant['fees'] ?? 0) + $frais];
    }
}
