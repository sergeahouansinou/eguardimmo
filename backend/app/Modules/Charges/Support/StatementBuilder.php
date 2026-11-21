<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Data\BuiltStatement;
use App\Modules\Charges\Data\ComputeInputs;
use App\Modules\Charges\Data\ItemBasis;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeItem;
use Illuminate\Support\Collection;
use Money\Money;

/**
 * Décomptes en aperçu : une ligne par poste et par bail, parts arrondies à l'unité mineure inférieure, reste au propriétaire (ADR 0034 § 5).
 */
final readonly class StatementBuilder
{
    public function __construct(private ShareCalculator $calcul) {}

    /**
     * @param  Collection<int, ChargeItem>  $postes
     * @param  array<string, ItemBasis>  $bases
     * @return list<BuiltStatement>
     */
    public function build(ChargeExercise $exercice, Collection $postes, array $bases, ComputeInputs $in, string $devise, string $templateVersion): array
    {
        $parBail = $this->lines($postes, $bases, $in);
        $monnaie = Currencies::of($devise);
        $resultat = [];

        foreach ($parBail as $bail => $lignes) {
            $total = array_sum(array_column($lignes, 'share'));
            $appels = isset($in->provisions[$bail]) ? $in->provisions[$bail]->called : new Money(0, $monnaie);
            $impayes = isset($in->provisions[$bail]) ? $in->provisions[$bail]->unpaid : new Money(0, $monnaie);
            $jours = $in->unionDaysByLease[$bail] ?? 0;
            $entier = $in->end->equalTo($in->start->addMonths(12)) && $jours === $in->periodDays;
            $suggere = $entier ? (int) $this->calcul->suggestedMonthly(new Money($total, $monnaie))->getAmount() : 0;
            $mandant = $in->mandants[$bail] ?? ['mandate' => null, 'mandant' => null];

            $resultat[] = new BuiltStatement($bail, [
                'exercise_id' => $exercice->id, 'lease_id' => $bail, 'status' => 'computed', 'occupied_days' => $jours,
                'share_total' => $total, 'provisions_called' => (int) $appels->getAmount(), 'provisions_unpaid' => (int) $impayes->getAmount(),
                'balance' => $total - (int) $appels->getAmount(), 'suggested_monthly_provision' => $suggere, 'currency' => $devise,
                'mandate_id' => $mandant['mandate'], 'mandant_party_id' => $mandant['mandant'],
                'snapshot' => json_encode(['period_start' => $in->start->toDateString(), 'period_end' => $in->end->toDateString()], JSON_THROW_ON_ERROR),
                'fingerprint' => Idempotency::fingerprint([$exercice->id, $bail, $total, $appels->getAmount(), $impayes->getAmount(), $mandant, $lignes]),
                'template_version' => $templateVersion, 'lock_version' => 1,
                'supersedes_id' => $exercice->supersedes_statement_id, 'rectification_reason' => $exercice->rectification_reason,
            ], $lignes);
        }

        return $resultat;
    }

    /**
     * @param  Collection<int, ChargeItem>  $postes
     * @param  array<string, ItemBasis>  $bases
     * @return array<string, list<array<string, mixed>>>
     */
    private function lines(Collection $postes, array $bases, ComputeInputs $in): array
    {
        $parBail = [];

        foreach ($postes as $rang => $poste) {
            $base = $bases[$poste->id];
            $poidsJours = [];
            $poids = [];
            $jours = [];

            foreach ($in->daysByLeaseUnit as $bail => $parLot) {
                foreach ($parLot as $lot => $nombre) {
                    $valeur = $base->weights[$lot] ?? 0;

                    if ($valeur > 0 && $nombre > 0) {
                        $poidsJours[$bail] = ($poidsJours[$bail] ?? 0) + $valeur * $nombre;
                        $poids[$bail] = ($poids[$bail] ?? 0) + $valeur;
                        $jours[$bail] = max($jours[$bail] ?? 0, $nombre);
                    }
                }
            }

            if ($poidsJours === []) {
                continue;
            }

            $partage = $this->calcul->split($poste->amount, $base->denominator, $in->periodDays, $poidsJours);

            if ($partage->owner->isNegative()) {
                throw ErrorCode::ItemInvalid->problem(sprintf('Les parts du poste « %s » dépassent son montant : deux baux occupent le même lot aux mêmes dates.', $poste->label));
            }

            foreach ($partage->shares as $bail => $part) {
                $parBail[$bail][] = [
                    'item_id' => $poste->id, 'label' => $poste->label, 'rubric' => $poste->rubric,
                    'split_label' => SplitLabels::label($base->kind, $poids[$bail], $base->denominator),
                    'item_amount' => (int) $poste->amount->getAmount(), 'weight' => $poids[$bail], 'denominator' => $base->denominator,
                    'days' => $jours[$bail], 'share' => (int) $part->getAmount(), 'position' => $rang + 1,
                ];
            }
        }

        return $parBail;
    }
}
