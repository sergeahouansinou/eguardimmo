<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Data\ItemInputData;
use App\Modules\Charges\Data\SourceInputData;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Enums\KeyKind;
use App\Modules\Charges\Jurisdictions\ChargeRules;
use App\Modules\Charges\Models\ChargeConsumption;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeItem;
use App\Modules\Charges\Models\ChargeItemSource;
use App\Modules\Charges\Models\ChargeKey;
use App\Modules\Properties\Data\UnitData;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Illuminate\Support\Facades\DB;
use Money\Money;

/**
 * Remplace les postes d'un exercice en brouillon ou calculé (ADR 0034 § 5) : le montant d'un poste est la somme de ses sources, jamais une saisie.
 * Appelé sous le verrou du bien et de l'exercice ; les sources se verrouillent ici, dans un ordre fixe.
 */
final readonly class ExerciseItems
{
    public function __construct(
        private Locks $verrous,
        private SourceCaps $plafonds,
        private UnitDirectory $lots,
        private StatementStore $decomptes,
    ) {}

    /**
     * @param  list<ItemInputData>  $postes
     */
    public function replace(ChargeExercise $exercice, array $postes, ChargeRules $regles, string $devise): void
    {
        $lots = array_map(fn (UnitData $l): string => $l->id, $this->lots->ofProperty($exercice->property_id));
        $anciennes = array_values(array_map(strval(...), ChargeItem::query()->where('exercise_id', $exercice->id)->whereNotNull('key_id')->pluck('key_id')->all()));

        foreach ($postes as $poste) {
            $this->assertItem($poste, $exercice, $regles, $lots, $anciennes);
        }

        $this->lockSources($postes);
        $retenues = $this->retained($postes, $exercice);
        $this->purge($exercice);
        $this->decomptes->purgeComputed($exercice->id);

        foreach ($postes as $rang => $poste) {
            $montant = new Money(array_sum(array_map(fn (array $s): int => $s['amount'], $retenues[$rang])), Currencies::of($devise));
            $ligne = ChargeItem::query()->create([
                'exercise_id' => $exercice->id, 'label' => trim($poste->label), 'rubric' => $poste->rubric, 'key_id' => $poste->keyId, 'unit_id' => $poste->unitId,
                'amount' => $montant, 'currency' => $devise, 'position' => $rang + 1,
            ]);

            foreach ($retenues[$rang] as $source) {
                ChargeItemSource::query()->create(['item_id' => $ligne->id, 'exercise_id' => $exercice->id, 'source_kind' => $source['kind'], 'source_id' => $source['id'], 'amount' => $source['amount']]);
            }

            foreach ($poste->consumptions as $lot => $quantite) {
                ChargeConsumption::query()->create(['item_id' => $ligne->id, 'unit_id' => $lot, 'quantity_milli' => $quantite]);
            }
        }

        $exercice->forceFill(['status' => ExerciseStatus::Draft, 'computed_at' => null, 'lock_version' => $exercice->lock_version + 1])->save();
    }

    /**
     * @param  list<string>  $lots
     * @param  list<string>  $clesDejaUtilisees
     */
    private function assertItem(ItemInputData $poste, ChargeExercise $exercice, ChargeRules $regles, array $lots, array $clesDejaUtilisees): void
    {
        if (! in_array($poste->rubric, $regles->recoverableRubrics(), true) || trim($poste->label) === '' || ($poste->keyId === null) === ($poste->unitId === null) || $poste->sources === []) {
            throw ErrorCode::ItemInvalid->problem('Un poste porte un libellé, une rubrique de la liste, une clé ou un lot, et au moins une source.');
        }

        if ($poste->unitId !== null && (! in_array($poste->unitId, $lots, true) || $poste->consumptions !== [])) {
            throw ErrorCode::ItemInvalid->problem('Le lot du poste n\'appartient pas à ce bien.');
        }

        if ($poste->keyId !== null) {
            $this->assertKey($poste, $exercice, $lots, $clesDejaUtilisees);
        }
    }

    /**
     * @param  list<string>  $lots
     * @param  list<string>  $clesDejaUtilisees
     */
    private function assertKey(ItemInputData $poste, ChargeExercise $exercice, array $lots, array $clesDejaUtilisees): void
    {
        $cle = ChargeKey::query()->where('property_id', $exercice->property_id)->whereKey((string) $poste->keyId)->first() ?? throw ErrorCode::ItemInvalid->problem('Cette clé n\'appartient pas à ce bien.');

        if ($cle->archived_at !== null && ! in_array($cle->id, $clesDejaUtilisees, true)) {
            throw ErrorCode::KeyArchived->problem();
        }

        $consommation = $cle->kind === KeyKind::Consumption;

        if ($consommation !== ($poste->consumptions !== [])) {
            throw ErrorCode::ItemInvalid->problem($consommation ? 'Saisissez la quantité consommée de chaque lot.' : 'Seule une clé de consommation porte des quantités.');
        }

        foreach ($poste->consumptions as $lot => $quantite) {
            if (! in_array($lot, $lots, true) || $quantite <= 0) {
                throw ErrorCode::ItemInvalid->problem('Chaque quantité concerne un lot du bien et reste positive.');
            }
        }
    }

    /**
     * @param  list<ItemInputData>  $postes
     */
    private function lockSources(array $postes): void
    {
        $cles = [];

        foreach ($postes as $poste) {
            foreach ($poste->sources as $source) {
                $cles[$source->kind->value.':'.$source->id] = $source;
            }
        }

        ksort($cles);

        foreach ($cles as $source) {
            $this->verrous->source($source->kind, $source->id);
        }
    }

    /**
     * @param  list<ItemInputData>  $postes
     * @return list<list<array{kind: string, id: string, amount: int}>>
     */
    private function retained(array $postes, ChargeExercise $exercice): array
    {
        $cumul = [];
        $resultat = [];

        foreach ($postes as $poste) {
            $retenues = [];
            $vues = [];

            foreach ($poste->sources as $source) {
                $cle = $source->kind->value.':'.$source->id;

                if (isset($vues[$cle])) {
                    throw ErrorCode::ItemInvalid->problem('Une source ne figure qu\'une fois par poste.');
                }

                $vues[$cle] = true;
                $retenu = $this->amountOf($source, $exercice);
                $cumul[$cle] = ($cumul[$cle] ?? 0) + $retenu['amount'];

                if ($cumul[$cle] > $retenu['cap'] - $this->plafonds->usedElsewhere($source->kind, $source->id, $exercice)) {
                    throw ErrorCode::SourceExhausted->problem();
                }

                $retenues[] = ['kind' => $source->kind->value, 'id' => $source->id, 'amount' => $retenu['amount']];
            }

            $resultat[] = $retenues;
        }

        return $resultat;
    }

    /**
     * @return array{amount: int, cap: int}
     */
    private function amountOf(SourceInputData $source, ChargeExercise $exercice): array
    {
        $resolu = $this->plafonds->resolve($source->kind, $source->id, $exercice);
        $montant = $source->amount ?? (int) $resolu['proposal']->getAmount();
        $plafond = (int) $resolu['cap']->getAmount();

        if ($montant <= 0 || $montant > $plafond) {
            throw ErrorCode::ItemInvalid->problem('Le montant retenu d\'une source est positif et ne dépasse pas sa part récupérable.');
        }

        return ['amount' => $montant, 'cap' => $plafond];
    }

    private function purge(ChargeExercise $exercice): void
    {
        $postes = ChargeItem::query()->where('exercise_id', $exercice->id)->pluck('id')->all();

        if ($postes !== []) {
            DB::table('charge_consumptions')->whereIn('item_id', $postes)->delete();
            DB::table('charge_item_sources')->whereIn('item_id', $postes)->delete();
            DB::table('charge_items')->whereIn('id', $postes)->delete();
        }
    }
}
