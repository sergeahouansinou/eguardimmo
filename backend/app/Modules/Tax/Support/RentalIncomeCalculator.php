<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

use App\Modules\Tax\Data\FactEntryData;
use App\Modules\Tax\Data\FormDefinition;
use App\Modules\Tax\Data\FormLineData;
use App\Modules\Tax\Data\IncomeFacts;
use App\Modules\Tax\Data\LineResultData;
use App\Modules\Tax\Data\PropertyResultData;
use App\Modules\Tax\Data\RentalIncomeData;

/**
 * Fonction pure (ADR 0039, 6) : des montants exacts par bien et par ligne, puis chaque ligne arrondie à l'euro le plus proche
 * (0,50 vers le haut), les totaux recalculés depuis les lignes arrondies, les exacts gardés à côté.
 */
final readonly class RentalIncomeCalculator
{
    public function __construct(private int $sourcesMax = 200) {}

    public function compute(FormDefinition $formulaire, IncomeFacts $faits, bool $provisional, bool $householdComplete): RentalIncomeData
    {
        $parBien = $this->grouper($faits);
        $conflits = array_column($faits->blockers, 'property_id');
        $ids = array_values(array_unique([...array_keys($faits->propertyNames), ...array_keys($parBien), ...array_keys($faits->premises)]));
        usort($ids, fn (string $a, string $b): int => [$faits->propertyNames[$a] ?? '', $a] <=> [$faits->propertyNames[$b] ?? '', $b]);

        $biens = [];

        foreach ($ids as $id) {
            $locaux = $faits->premises[$id] ?? 0;
            $biens[] = new PropertyResultData($id, $faits->propertyNames[$id] ?? '', $locaux, $this->lignes($formulaire, $parBien[$id] ?? [], $locaux, in_array($id, $conflits, true)), $faits->coOwners[$id] ?? []);
        }

        $totaux = $this->totalLines($formulaire, $biens);
        $avertissements = $faits->warnings;

        foreach ($biens as $bien) {
            $bien->coOwners === [] || $avertissements[] = ['code' => 'shared_ownership', 'property_id' => $bien->propertyId];

            foreach ($bien->lines as $ligne) {
                $ligne->exact < 0 && $avertissements[] = ['code' => 'negative_line', 'property_id' => $bien->propertyId, 'detail' => $ligne->code];
                $ligne->sourcesTruncated && $avertissements[] = ['code' => 'sources_truncated', 'property_id' => $bien->propertyId, 'detail' => $ligne->code];
            }
        }

        return new RentalIncomeData(
            $formulaire->incomeYear, $formulaire->version, $formulaire->templateVersion, $formulaire->currency, $provisional, $householdComplete, $biens, $totaux,
            $this->micro($formulaire, $totaux), $householdComplete ? $this->deficit($formulaire, $totaux) : null, $avertissements, $faits->blockers, $formulaire->warning, $formulaire->mentions,
        );
    }

    /**
     * @return array<string, array<string, list<FactEntryData>>>
     */
    private function grouper(IncomeFacts $faits): array
    {
        $groupes = [];

        foreach ($faits->entries as $entree) {
            $groupes[$entree->propertyId][$entree->lineCode][] = $entree;
        }

        return $groupes;
    }

    /**
     * @param  array<string, list<FactEntryData>>  $entrees  par ligne
     * @return list<LineResultData>
     */
    private function lignes(FormDefinition $formulaire, array $entrees, int $locaux, bool $conflit): array
    {
        $exacts = [];
        $arrondis = [];
        $resultats = [];

        foreach ($formulaire->lines as $definition) {
            if ($definition->kind === FormLineData::TOTAL) {
                continue;
            }

            $sources = array_map(fn (FactEntryData $e): array => ['kind' => $e->kind, 'ref' => $e->ref, 'amount' => $e->amount], $entrees[$definition->code] ?? []);

            if ($definition->code === '222' && $locaux > 0) {
                $sources[] = ['kind' => FactEntryData::FLAT_FEE, 'ref' => (string) $locaux, 'amount' => $locaux * $formulaire->flatFeePerPremises];
            }

            $exact = $definition->kind === FormLineData::TO_COMPLETE || ($conflit && $definition->code === '250') ? 0 : array_sum(array_column($sources, 'amount'));
            $statut = match (true) {
                $definition->kind === FormLineData::TO_COMPLETE => FormLineData::TO_COMPLETE,
                $conflit && $definition->code === '250' => LineResultData::CONFLICT,
                in_array(FactEntryData::CO_OWNERSHIP_STATEMENT, array_column($sources, 'kind'), true) => LineResultData::PROPOSED,
                default => FormLineData::COMPUTED,
            };
            $exacts[$definition->code] = $exact;
            $arrondis[$definition->code] = Rounding::toMajor($exact, $formulaire->minorPerMajor);
            $resultats[$definition->code] = new LineResultData(
                $definition->code, $definition->label, $statut, $exact, $arrondis[$definition->code],
                array_slice($exact === 0 && $statut !== FormLineData::COMPUTED ? [] : $sources, 0, $this->sourcesMax), count($sources) > $this->sourcesMax,
            );
        }

        $sortie = [];

        foreach ($formulaire->lines as $definition) {
            if ($definition->kind === FormLineData::TOTAL) {
                $exacts[$definition->code] = $this->formule($formulaire->totals[$definition->code], $exacts);
                $arrondis[$definition->code] = $this->formule($formulaire->totals[$definition->code], $arrondis);
                $resultats[$definition->code] = new LineResultData($definition->code, $definition->label, FormLineData::TOTAL, $exacts[$definition->code], $arrondis[$definition->code]);
            }

            $sortie[] = $resultats[$definition->code];
        }

        return $sortie;
    }

    /**
     * @param  list<PropertyResultData>  $biens
     * @return list<LineResultData>
     */
    private function totalLines(FormDefinition $formulaire, array $biens): array
    {
        $exacts = [];
        $arrondis = [];
        $statuts = [];

        foreach ($formulaire->lines as $definition) {
            $exacts[$definition->code] = 0;
            $arrondis[$definition->code] = 0;
            $statuts[$definition->code] = $definition->kind === FormLineData::TO_COMPLETE ? FormLineData::TO_COMPLETE : ($definition->kind === FormLineData::TOTAL ? FormLineData::TOTAL : FormLineData::COMPUTED);

            foreach ($biens as $bien) {
                $ligne = $bien->line($definition->code);
                $exacts[$definition->code] += $ligne->exact;
                $arrondis[$definition->code] += $ligne->rounded;

                if (in_array($ligne->status, [LineResultData::CONFLICT, LineResultData::PROPOSED], true) && $statuts[$definition->code] === FormLineData::COMPUTED) {
                    $statuts[$definition->code] = $ligne->status;
                }
            }
        }

        $sortie = [];

        foreach ($formulaire->lines as $definition) {
            $sortie[] = new LineResultData($definition->code, $definition->label, $statuts[$definition->code], $exacts[$definition->code], $arrondis[$definition->code]);
        }

        return $sortie;
    }

    /**
     * @param  array{plus: list<string>, minus: list<string>}  $formule
     * @param  array<string, int>  $valeurs
     */
    private function formule(array $formule, array $valeurs): int
    {
        return array_sum(array_map(fn (string $c): int => $valeurs[$c] ?? 0, $formule['plus'])) - array_sum(array_map(fn (string $c): int => $valeurs[$c] ?? 0, $formule['minus']));
    }

    /**
     * @param  list<LineResultData>  $totaux
     * @return array{gross_receipts: int, allowance_bp: int, base_after_allowance: int, threshold: int, real_base: int}
     */
    private function micro(FormDefinition $formulaire, array $totaux): array
    {
        $brut = $this->valeur($totaux, '215');
        $abattement = Rounding::toMajor(Rounding::divide($brut * $formulaire->microAllowanceBp, Rounding::BASIS_POINTS), $formulaire->minorPerMajor);

        return [
            'gross_receipts' => $brut,
            'allowance_bp' => $formulaire->microAllowanceBp,
            'base_after_allowance' => $brut - $abattement,
            'threshold' => $formulaire->microThreshold,
            'real_base' => max(0, $this->valeur($totaux, '263')),
        ];
    }

    /**
     * @param  list<LineResultData>  $totaux
     * @return array{result: int, interest_part: int, other_part: int, imputable_on_global_income: int, carried_forward: int}
     */
    private function deficit(FormDefinition $formulaire, array $totaux): array
    {
        $resultat = $this->valeur($totaux, '263');

        if ($resultat >= 0) {
            return ['result' => $resultat, 'interest_part' => 0, 'other_part' => 0, 'imputable_on_global_income' => 0, 'carried_forward' => 0];
        }

        $deficit = -$resultat;
        $interets = min($deficit, max(0, $this->valeur($totaux, '250')));
        $autres = $deficit - $interets;
        $imputable = min($autres, $formulaire->deficitCeiling);

        return ['result' => $resultat, 'interest_part' => $interets, 'other_part' => $autres, 'imputable_on_global_income' => $imputable, 'carried_forward' => $autres - $imputable];
    }

    /**
     * @param  list<LineResultData>  $lignes
     */
    private function valeur(array $lignes, string $code): int
    {
        foreach ($lignes as $ligne) {
            if ($ligne->code === $code) {
                return $ligne->rounded;
            }
        }

        return 0;
    }
}
