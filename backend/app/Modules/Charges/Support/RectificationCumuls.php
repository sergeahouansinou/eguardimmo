<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\ExerciseStatus;
use Illuminate\Support\Facades\DB;

/**
 * Cumul de chaque source selon un exercice rectificatif : ce qu'il retient lui-même, plus ce que retiennent les exercices d'origine autres que
 * celui dont il corrige un décompte (ADR 0034 § 5). Lecture directe des tables du module, bornée par l'organisation.
 */
final class RectificationCumuls
{
    private const int PROFONDEUR_MAX = 50;

    /**
     * @return list<object{kind: string, id: string, total: int}>
     */
    public function of(string $org): array
    {
        $rectificatifs = DB::table('charge_exercises')->where('organization_id', $org)->whereNotNull('only_lease_id')->where('status', '<>', ExerciseStatus::Discarded->value)
            ->pluck('supersedes_statement_id', 'id')->all();

        if ($rectificatifs === []) {
            return [];
        }

        $exercices = DB::table('charge_exercises')->where('organization_id', $org)->whereNotNull('only_lease_id')->pluck('supersedes_statement_id', 'id')->all();
        $decomptes = DB::table('charge_statements')->where('organization_id', $org)->whereIn('id', array_values(array_filter($exercices)))->pluck('exercise_id', 'id')->all();
        $cumuls = [];

        foreach (array_keys($rectificatifs) as $rectificatif) {
            $origine = $this->origin((string) $rectificatif, $exercices, $decomptes);

            foreach (DB::table('charge_item_sources')->where('organization_id', $org)->where('exercise_id', $rectificatif)->groupBy('source_kind', 'source_id')->selectRaw('source_kind as kind, source_id as id, SUM(amount) as total')->get() as $propre) {
                $cumuls[] = (object) ['kind' => (string) $propre->kind, 'id' => (string) $propre->id, 'total' => (int) $propre->total + $this->others($org, (string) $propre->kind, (string) $propre->id, $origine)];
            }
        }

        return $cumuls;
    }

    private function others(string $org, string $kind, string $sourceId, string $origine): int
    {
        return (int) DB::table('charge_item_sources as s')->join('charge_exercises as e', 'e.id', '=', 's.exercise_id')
            ->where('s.organization_id', $org)->where('s.source_kind', $kind)->where('s.source_id', $sourceId)
            ->where('e.status', '<>', ExerciseStatus::Discarded->value)->whereNull('e.only_lease_id')->where('e.id', '<>', $origine)
            ->sum('s.amount');
    }

    /**
     * @param  array<string, string|null>  $exercices  exercice rectificatif => décompte rectifié
     * @param  array<string, string>  $decomptes  décompte => exercice
     */
    private function origin(string $exercice, array $exercices, array $decomptes): string
    {
        for ($profondeur = 0; $profondeur < self::PROFONDEUR_MAX && array_key_exists($exercice, $exercices); $profondeur++) {
            $suivant = $decomptes[$exercices[$exercice] ?? ''] ?? null;

            if ($suivant === null) {
                break;
            }

            $exercice = (string) $suivant;
        }

        return $exercice;
    }
}
